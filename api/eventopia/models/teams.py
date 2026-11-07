from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, Json

from eventopia.models.activities import CategoryRef, GeoName
from eventopia.models.geo import CategoryOut, LocationOut

Position = Literal["Goalkeeper", "Defender", "Midfielder", "Forward"]


class TeamIn(BaseModel):
    name: str = Field(min_length=1)
    men_team: bool
    public_team: bool
    country_name: str = Field(min_length=1)
    state_name: str = Field(min_length=1)
    city_name: str = Field(min_length=1)
    location: str = Field(min_length=1)
    categories: Json[list[CategoryRef]]
    sponsors: Json[list[str]] = []
    belongs_to_organization: str | None = None
    founded_at: datetime | None = None
    tshirt_color: str | None = None
    shorts_color: str | None = None
    socks_color: str | None = None
    away_tshirt_color: str | None = None


class JoinTeamIn(BaseModel):
    name_on_jersey: str
    player_number: int
    position: Position


class TeamOut(BaseModel):
    away_tshirt_color: list[GeoName]
    categories: list[CategoryOut]
    city_name: str
    country_name: str
    founded_at: str | None
    image_url: str | None
    location: list[LocationOut]
    men_team: bool
    name: str
    public_team: bool
    shorts_color: list[GeoName]
    socks_color: list[GeoName]
    state_name: str
    tshirt_color: list[GeoName]


class TeamMemberOut(BaseModel):
    username: str
    first_name: str
    last_name: str
    image_url: str | None
    name_on_jersey: str
    role: Position
    plays_for_division: int | None
    player_number: int


class TeamDetailOut(TeamOut):
    members: list[TeamMemberOut]
    sponsors: list[GeoName]
    belongs_to_organization: list[GeoName]
