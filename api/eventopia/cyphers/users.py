from neo4j import AsyncManagedTransaction

from eventopia.models.auth import UserProfile

_PROFILE = """u { .uid, .username, .first_name, .last_name, .image_url, .gender,
                  birth_date: toString(u.birth_date) } AS profile"""


async def merge_user(
    tx: AsyncManagedTransaction,
    uid: str,
    username: str,
    first_name: str | None,
    last_name: str | None,
    created_at_iso: str,
) -> UserProfile:
    result = await tx.run(
        "CYPHER 25 MERGE (u:USER {uid:$uid}) "
        "ON CREATE SET u.username=$username, u.first_name=$first_name, "
        "u.last_name=$last_name, u.created_at=datetime($created_at), "
        "u.claimed=true RETURN " + _PROFILE,
        uid=uid,
        username=username,
        first_name=first_name,
        last_name=last_name,
        created_at=created_at_iso,
    )
    record = await result.single(strict=True)
    return UserProfile(**record["profile"])


async def select_user(tx: AsyncManagedTransaction, uid: str) -> UserProfile | None:
    result = await tx.run(
        "CYPHER 25 MATCH (u:USER {uid:$uid}) RETURN " + _PROFILE, uid=uid
    )
    record = await result.single()
    return UserProfile(**record["profile"]) if record is not None else None


async def username_taken(tx: AsyncManagedTransaction, username: str) -> bool:
    result = await tx.run(
        "CYPHER 25 MATCH (u:USER {username:$username}) RETURN count(u) > 0 AS taken",
        username=username,
    )
    return (await result.single(strict=True))["taken"]
