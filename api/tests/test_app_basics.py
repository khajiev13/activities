import asyncio
import io
import logging
from uuid import UUID

import pytest
from pydantic import BaseModel

from eventopia import create_app
from eventopia.context.request_id import configure_logging, current_request_id
from eventopia.exceptions import (
    AuthError,
    ConflictError,
    ForbiddenError,
    ForeignContactError,
    InvalidCodeError,
    NotFoundError,
    PhoneRequiredError,
    RateLimitedError,
    ValidationError,
)
from eventopia.models.common import ok
from eventopia.wiring import Container


async def test_health_live_envelope(client):
    response = await client.get("/api/health/live")
    body = response.json()
    assert response.status_code == 200
    assert body == {
        "requestId": response.headers["X-Request-ID"],
        "error": 0,
        "data": {"status": "ok"},
    }
    assert UUID(body["requestId"]).version == 4


async def test_request_id_is_echoed(client):
    response = await client.get(
        "/api/health/live", headers={"X-Request-ID": "caller-request"}
    )
    assert response.headers["X-Request-ID"] == "caller-request"
    assert response.json()["requestId"] == "caller-request"


@pytest.mark.parametrize(
    ("exception_type", "status", "code"),
    [
        (AuthError, 401, 101),
        (InvalidCodeError, 401, 102),
        (PhoneRequiredError, 403, 103),
        (ForbiddenError, 403, 104),
        (ForeignContactError, 400, 105),
        (ValidationError, 422, 201),
        (NotFoundError, 404, 300),
        (ConflictError, 409, 400),
    ],
)
async def test_service_exception_shape(client, app, exception_type, status, code):
    @app.get("/boom")
    async def boom():
        raise exception_type("taken")

    response = await client.get("/boom", headers={"X-Request-ID": "error-request"})
    assert response.status_code == status
    assert response.json() == {
        "requestId": "error-request",
        "error": code,
        "message": "taken",
    }
    assert response.headers["X-Request-ID"] == "error-request"


async def test_rate_limited_includes_retry_after(client, app):
    @app.get("/limited")
    async def limited():
        raise RateLimitedError(retry_after=42)

    response = await client.get("/limited")
    assert response.status_code == 429
    assert response.json()["error"] == 202
    assert response.json()["retry_after"] == 42
    assert response.json()["message"]


async def test_unknown_exception_is_generic_500(client, app, caplog):
    configure_logging("INFO")

    @app.get("/boom")
    async def boom():
        raise RuntimeError("TEST_ONLY_PRIVATE_DETAIL")

    response = await client.get("/boom", headers={"X-Request-ID": "failed-request"})
    assert response.status_code == 500
    assert response.json()["error"] == 500
    assert response.json()["requestId"] == "failed-request"
    assert response.headers["X-Request-ID"] == "failed-request"
    assert "TEST_ONLY_PRIVATE_DETAIL" not in response.text
    assert "TEST_ONLY_PRIVATE_DETAIL" not in caplog.text
    records = [record for record in caplog.records if record.name == "eventopia"]
    assert records and records[-1].request_id == "failed-request"
    assert "boom" in records[-1].getMessage()
    assert "RuntimeError" in records[-1].getMessage()


async def test_request_validation_is_422_code_200(client, app):
    class Input(BaseModel):
        count: int
        token: str

    @app.post("/validate")
    async def validate(body: Input):
        return ok(body.model_dump())

    response = await client.post(
        "/validate", json={"count": "TEST_ONLY_PRIVATE_INPUT", "token": "private"}
    )
    body = response.json()
    assert response.status_code == 422
    assert body["error"] == 200
    assert body["requestId"] == response.headers["X-Request-ID"]
    assert body["details"][0]["loc"] == ["body", "count"]
    assert "TEST_ONLY_PRIVATE_INPUT" not in response.text
    assert "private" not in response.text


async def test_trailing_slash_is_not_redirected(client):
    response = await client.get("/api/health/live/")
    assert response.status_code == 404
    assert response.json()["error"] == 300
    assert response.json()["requestId"] == response.headers["X-Request-ID"]


async def test_method_not_allowed_uses_envelope(client):
    response = await client.post("/api/health/live")
    assert response.status_code == 405
    assert response.json()["error"] != 0
    assert response.headers["Allow"] == "GET"


async def test_log_records_carry_request_id(client, app, caplog):
    configure_logging("INFO")

    @app.get("/log")
    async def log():
        logging.getLogger("eventopia.test").info("test message")
        return ok({"status": "logged"})

    await client.get("/log", headers={"X-Request-ID": "logged-request"})
    record = next(record for record in caplog.records if record.msg == "test message")
    assert record.request_id == "logged-request"
    assert current_request_id() == "-"


async def test_request_ids_are_isolated(client, app):
    @app.get("/yield")
    async def yielding():
        await asyncio.sleep(0)
        return ok({"id": current_request_id()})

    responses = await asyncio.gather(
        *(
            client.get("/yield", headers={"X-Request-ID": value})
            for value in ("first", "second")
        )
    )
    assert [response.json()["data"]["id"] for response in responses] == [
        "first",
        "second",
    ]
    assert current_request_id() == "-"


async def test_lifespan_closes_container():
    class ClosingContainer(Container):
        closed = False

        async def close(self):
            self.closed = True

    container = ClosingContainer(views=[])
    app = create_app(container)
    async with app.router.lifespan_context(app):
        assert not container.closed
    assert container.closed


async def test_existing_log_handler_emits_request_id(client, app):
    output = io.StringIO()
    handler = logging.StreamHandler(output)
    handler.setFormatter(logging.Formatter("%(message)s"))
    root = logging.getLogger()
    root.addHandler(handler)
    try:
        configure_logging("INFO")

        @app.get("/existing-handler-log")
        async def log():
            logging.getLogger("eventopia.test").info("existing handler message")
            return ok({"status": "logged"})

        await client.get(
            "/existing-handler-log", headers={"X-Request-ID": "existing-handler-id"}
        )
        line = next(
            line
            for line in output.getvalue().splitlines()
            if "existing handler message" in line
        )
        assert "[existing-handler-id]" in line
    finally:
        root.removeHandler(handler)
        handler.close()


async def test_lifespan_finishes_delivery_before_closing_its_dependencies():
    events = []
    entered, release = asyncio.Event(), asyncio.Event()

    class Delivery:
        async def close(self):
            events.append("delivery-start")
            entered.set()
            await release.wait()
            events.append("delivery-finished")

    class Resource:
        async def close(self):
            assert events[-1] == "delivery-finished"
            events.append("resource")

    app = create_app(Container(views=[], otp_service=Delivery(), sqlite=Resource()))

    async def run_lifespan():
        async with app.router.lifespan_context(app):
            pass

    shutdown = asyncio.create_task(run_lifespan())
    try:
        await asyncio.wait_for(entered.wait(), timeout=2)
        assert events == ["delivery-start"]
    finally:
        release.set()
        await shutdown
    assert events == ["delivery-start", "delivery-finished", "resource"]


async def test_other_resources_close_even_if_delivery_shutdown_fails():
    closed = []

    class Delivery:
        async def close(self):
            raise RuntimeError("synthetic shutdown failure")

    class Resource:
        async def close(self):
            closed.append(True)

    container = Container(views=[], otp_service=Delivery(), sqlite=Resource())
    with pytest.raises(RuntimeError):
        await container.close()
    assert closed == [True]
