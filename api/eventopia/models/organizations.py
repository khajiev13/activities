from pydantic import BaseModel, Field

from eventopia.models.activities import GeoName
from eventopia.models.geo import LocationOut


class OrganizationIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    pk_for_location: str = Field(min_length=1)
    country: str = Field(min_length=1)
    state: str = Field(min_length=1)
    city: str = Field(min_length=1)


class OrganizationRef(BaseModel):
    pk: str
    name: str


class OrganizationOut(OrganizationRef):
    created_at: str
    location: LocationOut
    country: GeoName
    state: GeoName
    city: GeoName
    image_url: str | None
    teams_count: int
    number_of_people_joined: int
    number_of_teams_sponsored: int
    hosting_leagues_count: int
    hosting_activities_count: int
