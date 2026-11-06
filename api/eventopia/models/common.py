from typing import Any

from eventopia.context.request_id import current_request_id


def ok(data: Any) -> dict:
    return {"requestId": current_request_id(), "error": 0, "data": data}


def error(code: int, message: str, **extra: Any) -> dict:
    return {
        **extra,
        "requestId": current_request_id(),
        "error": code,
        "message": message,
    }
