import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from random import Random
from uuid import NAMESPACE_URL, uuid5

from eventopia.context.neo4j import Neo4jConnector
from eventopia.cyphers.seed import merge_seed

# Stable identity across machines and reruns; birthdays never leave this loader.
_PLAYER_NAMESPACE = uuid5(NAMESPACE_URL, "https://eventopia.live/seed/players")
_COLORS = ("Red", "Blue", "Green", "Yellow", "Black", "White", "Orange", "Purple")
_SQUAD_FILE = re.compile(r"(male|female)_division_(\d+)(_7s)?\.json")


@dataclass(frozen=True)
class SeedSummary:
    teams: int
    players: int
    memberships: int
    leagues: int
    pitches: int


def _slug(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", ascii_name.lower()).strip("_") or "player"


async def seed_all(
    connector: Neo4jConnector, data_dir: Path, rng: Random
) -> SeedSummary:
    teams = []
    players = {}
    memberships = {}
    for path in sorted(data_dir.glob("*.json")):
        match = _SQUAD_FILE.fullmatch(path.name)
        if match is None:
            continue
        for squad in json.loads(path.read_text(encoding="utf-8")):
            team_name = squad["name"] + (" 7s" if match[3] else "")
            teams.append(
                {
                    "name": team_name,
                    "men_team": match[1] == "male",
                    "founded_at": squad.get("established_date"),
                    "description": squad.get("description") or "",
                    "image_url": squad.get("image_url"),
                    "longitude": squad["longitude"],
                    "latitude": squad["latitude"],
                    "colors": [rng.choice(_COLORS) for _ in range(4)],
                }
            )
            for player in squad["players"]:
                uid = str(
                    uuid5(_PLAYER_NAMESPACE, f"{player['name']}|{player['birthday']}")
                )
                names = player["name"].split()
                players.setdefault(
                    uid,
                    {
                        "uid": uid,
                        "slug": _slug(player["name"]),
                        "first_name": names[0] if names else "",
                        "last_name": " ".join(names[1:]),
                        "nationality": player["nationality"],
                    },
                )
                # Duplicate source rows can disagree on jersey number. First wins.
                memberships.setdefault(
                    (uid, team_name),
                    {
                        "uid": uid,
                        "team": team_name,
                        "position": player["position"],
                        "name_on_jersey": player["name"],
                        "player_number": int(player["player_number"]),
                        "plays_for_division": int(match[2]),
                    },
                )
    await connector.write(
        lambda tx: merge_seed(
            tx, teams, list(players.values()), list(memberships.values())
        )
    )
    return SeedSummary(len(teams), len(players), len(memberships), 3, 4)
