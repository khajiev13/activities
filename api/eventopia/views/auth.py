from fastapi import Depends, Request, Response

from eventopia.config import AuthSection
from eventopia.models.auth import OtpRequestIn, OtpVerifyIn, WebAppLoginIn
from eventopia.models.common import ok
from eventopia.services.auth import AuthService
from eventopia.views.base import ApiView
from eventopia.views.deps import clear_refresh_cookie, require_xrw, set_refresh_cookie


class AuthView(ApiView):
    def __init__(self, auth_service: AuthService, auth_config: AuthSection) -> None:
        super().__init__()
        self._auth_service = auth_service
        self._config = auth_config
        for path, endpoint in (
            ("otp/request", self.request_otp),
            ("otp/verify", self.verify_otp),
            ("telegram/webapp", self.webapp),
        ):
            self.router.add_api_route("/api/auth/" + path, endpoint, methods=["POST"])
        for path, endpoint in (("refresh", self.refresh), ("logout", self.logout)):
            self.router.add_api_route(
                "/api/auth/" + path,
                endpoint,
                methods=["POST"],
                dependencies=[Depends(require_xrw)],
            )

    async def request_otp(self, body: OtpRequestIn, request: Request) -> dict:
        result = await self._auth_service.request_otp(
            body.phone, request.client.host if request.client else None
        )
        return ok(result.model_dump())

    async def verify_otp(
        self, body: OtpVerifyIn, request: Request, response: Response
    ) -> dict:
        result, raw = await self._auth_service.login_with_otp(
            body.phone,
            body.code,
            request.headers.get("User-Agent"),
            request.client.host if request.client else None,
        )
        set_refresh_cookie(response, raw, self._config)
        return ok(result.model_dump())

    async def webapp(self, body: WebAppLoginIn) -> dict:
        result = await self._auth_service.login_with_webapp(body.init_data)
        return ok(result.model_dump())

    async def refresh(self, request: Request, response: Response) -> dict:
        result, raw = await self._auth_service.refresh(
            request.cookies.get(self._config["refresh_cookie_name"])
        )
        if raw is not None:
            set_refresh_cookie(response, raw, self._config)
        return ok(result.model_dump())

    async def logout(self, request: Request, response: Response) -> dict:
        await self._auth_service.logout(
            request.cookies.get(self._config["refresh_cookie_name"])
        )
        clear_refresh_cookie(response, self._config)
        return ok({})
