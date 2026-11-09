import logging
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar

_request_id: ContextVar[str] = ContextVar("request_id", default="-")
_LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"


def current_request_id() -> str:
    return _request_id.get()


@contextmanager
def request_id_context(request_id: str) -> Iterator[None]:
    token = _request_id.set(request_id)
    try:
        yield
    finally:
        _request_id.reset(token)


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = current_request_id()
        return True


def configure_logging(level: str) -> None:
    logging.basicConfig(level=level, format=_LOG_FORMAT)
    root = logging.getLogger()
    root.setLevel(level)
    # Driver DEBUG traces include bound SQL parameters, bypassing SQLAlchemy
    # hide_parameters and exposing phones, codes or tokens. Keep them disabled.
    logging.getLogger("aiosqlite").setLevel(logging.WARNING)
    # S3 SDK DEBUG traces include signed headers, credentials and object keys.
    for name in ("boto3", "botocore", "s3transfer", "urllib3"):
        logging.getLogger(name).setLevel(logging.WARNING)
    for handler in root.handlers:
        handler.setFormatter(logging.Formatter(_LOG_FORMAT))
        if not any(isinstance(item, RequestIdFilter) for item in handler.filters):
            handler.addFilter(RequestIdFilter())
