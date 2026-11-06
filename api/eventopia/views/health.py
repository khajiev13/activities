from eventopia.models.common import ok

from .base import ApiView


class HealthView(ApiView):
    def __init__(self) -> None:
        super().__init__()
        self.router.add_api_route("/api/health/live", self.live, methods=["GET"])

    async def live(self) -> dict:
        return ok({"status": "ok"})
