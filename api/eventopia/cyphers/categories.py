from neo4j import AsyncManagedTransaction

from eventopia.models.geo import CategoryIn, CategoryOut

_PROJECTION = "c { .pk, .name, .is_indoor, .is_outdoor, .is_online } AS category"


async def select_categories(
    tx: AsyncManagedTransaction,
    is_indoor: bool | None,
    is_outdoor: bool | None,
    is_online: bool | None,
) -> list[CategoryOut]:
    result = await tx.run(
        "CYPHER 25 MATCH (c:CATEGORY) "
        "WHERE ($is_indoor IS NULL OR c.is_indoor = $is_indoor) "
        "AND ($is_outdoor IS NULL OR c.is_outdoor = $is_outdoor) "
        "AND ($is_online IS NULL OR c.is_online = $is_online) "
        "RETURN " + _PROJECTION + " ORDER BY c.name",
        is_indoor=is_indoor,
        is_outdoor=is_outdoor,
        is_online=is_online,
    )
    return [CategoryOut(**record["category"]) async for record in result]


async def insert_category(
    tx: AsyncManagedTransaction, category: CategoryIn
) -> CategoryOut | None:
    # Legacy/seeded categories may not yet carry the canonical key.
    result = await tx.run(
        "CYPHER 25 MATCH (c:CATEGORY) WHERE toLower(c.name) = toLower($name) "
        "RETURN count(c) > 0 AS taken",
        name=category.name,
    )
    if (await result.single(strict=True))["taken"]:
        return None
    result = await tx.run(
        "CYPHER 25 CREATE (c:CATEGORY {pk:randomUUID(), name:$name, "
        "name_key:toLower($name), is_indoor:$is_indoor, "
        "is_outdoor:$is_outdoor, is_online:$is_online}) RETURN " + _PROJECTION,
        **category.model_dump(),
    )
    record = await result.single(strict=True)
    return CategoryOut(**record["category"])
