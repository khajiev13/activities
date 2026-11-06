from fastapi.responses import JSONResponse

from eventopia.context.neo4j import Neo4jConnector
from eventopia.models.common import error, ok

from .base import ApiView


class HealthView(ApiView):
    def __init__(self, neo4j: Neo4jConnector) -> None:
        super().__init__()
        self._neo4j = neo4j
        self.router.add_api_route("/api/health/live", self.live, methods=["GET"])
        self.router.add_api_route("/api/health/ready", self.ready, methods=["GET"])

    async def live(self) -> dict:
        return ok({"status": "ok"})

    async def ready(self) -> JSONResponse:
        dependencies = {"neo4j": await self._neo4j.ping()}
        if not all(dependencies.values()):
            return JSONResponse(
                error(500, "Dependency unavailable", data=dependencies), status_code=503
            )
        return JSONResponse(ok(dependencies))
