from collections.abc import Callable

from fastapi import Request, Response

from eventopia.config import AuthSection
from eventopia.exceptions import ForbiddenError
from eventopia.models.auth import AccessClaims
from eventopia.services.auth import AuthService


def build_current_user(auth_service: AuthService) -> Callable:
    async def current_user(request: Request) -> AccessClaims:
        return await auth_service.authenticate(request.headers.get("Authorization"))

    return current_user


def require_xrw(request: Request) -> None:
    if request.headers.get("X-Requested-With") != "eventopia":
        raise ForbiddenError()


def set_refresh_cookie(response: Response, raw: str, auth_config: AuthSection) -> None:
    response.set_cookie(
        auth_config["refresh_cookie_name"],
        raw,
        max_age=auth_config["refresh_ttl_days"] * 86400,
        path="/api/auth",
        secure=auth_config["cookie_secure"],
        httponly=True,
        samesite="Strict",
    )


def clear_refresh_cookie(response: Response, auth_config: AuthSection) -> None:
    response.delete_cookie(
        auth_config["refresh_cookie_name"],
        path="/api/auth",
        secure=auth_config["cookie_secure"],
        httponly=True,
        samesite="Strict",
    )
