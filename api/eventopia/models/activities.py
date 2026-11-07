from pydantic import AwareDatetime, BaseModel, Field, model_validator

from eventopia.models.geo import LocationOut


class GeoName(BaseModel):
    name: str = Field(min_length=1)


class CategoryRef(GeoName):
    pk: str = Field(min_length=1)


class LocationRef(BaseModel):
    pk: str = Field(min_length=1)


class CompetitionIn(BaseModel):
    team_1: GeoName
    team_2: GeoName


class ActivityIn(BaseModel):
    title: str = Field(min_length=1)
    description: str
    public: bool
    date_time: AwareDatetime
    duration_in_minutes: int = Field(ge=0)
    location: LocationRef
    country: GeoName
    state: GeoName
    city: GeoName
    categories: list[CategoryRef]
    is_competition: bool
    competition: CompetitionIn | None = None

    @model_validator(mode="after")
    def require_competition_teams(self) -> "ActivityIn":
        if self.is_competition and self.competition is None:
            raise ValueError("Competition requires both teams")
        return self


class PersonOut(BaseModel):
    first_name: str | None
    last_name: str | None
    image_url: str | None
    username: str | None


class CreatorOut(BaseModel):
    first_name: str
    last_name: str
    image_url: str
    username: str


class CompetitionTeamOut(BaseModel):
    name: str | None
    image_url: str | None


class CompetitionOut(BaseModel):
    team_1: CompetitionTeamOut
    team_2: CompetitionTeamOut


class ActivityOut(BaseModel):
    categories: list[CategoryRef]
    city: GeoName
    competition: CompetitionOut
    country: GeoName
    creator: CreatorOut
    date_time: str
    description: str
    duration_in_minutes: int
    location: LocationOut
    number_of_people_joined: int
    people_joined: list[PersonOut]
    pk: str
    public: bool
    state: GeoName
    title: str
