import logging
import traceback
from contextlib import asynccontextmanager
from http import HTTPStatus
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from eventopia.context.request_id import request_id_context
from eventopia.exceptions import RateLimitedError, ServiceException
from eventopia.models.common import error
from eventopia.wiring import Container

_logger = logging.getLogger(__name__)


def create_app(container: Container) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            yield
        finally:
            await container.close()

    app = FastAPI(redirect_slashes=False, lifespan=lifespan)

    @app.exception_handler(ServiceException)
    async def service_exception_handler(
        request: Request, exc: ServiceException
    ) -> JSONResponse:
        extra = (
            {"retry_after": exc.retry_after}
            if isinstance(exc, RateLimitedError)
            else {}
        )
        return JSONResponse(error(exc.code, exc.message, **extra), exc.http_status)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [{"loc": item["loc"], "type": item["type"]} for item in exc.errors()]
        return JSONResponse(
            error(200, "Request validation failed", details=details), 422
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(
        request: Request, exc: HTTPException
    ) -> JSONResponse:
        code = {401: 101, 403: 104, 404: 300, 409: 400, 422: 200, 429: 202}.get(
            exc.status_code, exc.status_code
        )
        return JSONResponse(
            error(code, HTTPStatus(exc.status_code).phrase),
            exc.status_code,
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def unknown_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        # Stack frames retain traceback context without exception messages or locals,
        # either of which may contain credentials or user input.
        stack = "\n".join(
            f'  File "{frame.f_code.co_filename}", line {line}, '
            f"in {frame.f_code.co_name}"
            for frame, line in traceback.walk_tb(exc.__traceback__)
        )
        _logger.error(
            "Unhandled %s\nTraceback (most recent call last):\n%s",
            type(exc).__name__,
            stack,
        )
        return JSONResponse(error(500, "Internal server error"), 500)

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        with request_id_context(request_id):
            try:
                response = await call_next(request)
            except Exception as exc:
                # Handle before context cleanup so failures keep the same ID in
                # the response envelope, header and traceback log.
                response = await unknown_exception_handler(request, exc)
            response.headers["X-Request-ID"] = request_id
            return response

    for view in container.views:
        app.include_router(view.router)
    return app
