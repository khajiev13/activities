from pydantic import AliasChoices, AliasPath, BaseModel, Field


class CityOut(BaseModel):
    name: str


class StateOut(BaseModel):
    name: str
    cities: list[CityOut]


class CountryOut(BaseModel):
    name: str
    states: list[StateOut]


class CategoryIn(BaseModel):
    name: str = Field(min_length=1)
    is_indoor: bool
    is_outdoor: bool
    is_online: bool


class CategoryOut(CategoryIn):
    pk: str


class Points(BaseModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class LocationIn(BaseModel):
    name: str = Field(min_length=1)
    country: str = Field(min_length=1)
    state: str = Field(min_length=1)
    city: str = Field(min_length=1)
    latitude: float = Field(
        ge=-90,
        le=90,
        allow_inf_nan=False,
        validation_alias=AliasChoices("latitude", AliasPath("points", "latitude")),
    )
    longitude: float = Field(
        ge=-180,
        le=180,
        allow_inf_nan=False,
        validation_alias=AliasChoices("longitude", AliasPath("points", "longitude")),
    )


class LocationOut(BaseModel):
    pk: str
    name: str
    points: Points
