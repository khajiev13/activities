from django_neomodel import DjangoNode
from neomodel import (StringProperty, UniqueIdProperty,
                      RelationshipFrom, RelationshipTo, DateProperty)
from teams.models import Since
from datetime import date


class ORGANIZATION(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True, max_length=100, unique_index=True)
    created_at = DateProperty(default=date.today)
    join_requests = RelationshipFrom('join_requests.models.REQUEST', 'TO_JOIN')
    location = RelationshipTo('locations.models.LOCATION', 'LOCATED_AT')
    country = RelationshipTo('countries.models.COUNTRY', 'COUNTRY_BASED_IN')
    state = RelationshipTo('states.models.STATE', 'STATE_BASED_IN')
    city = RelationshipTo('cities.models.CITY', 'CITY_BASED_IN')
    members = RelationshipFrom('users.models.USER', 'BELONGS_TO', model=Since)
    founder = RelationshipFrom('users.models.USER', 'CREATES')
    sponsors = RelationshipFrom('users.models.USER', 'SPONSORS', model=Since)
    teams = RelationshipTo('teams.models.TEAM', 'HAS_TEAM')
    sponsors_teams = RelationshipTo('teams.models.TEAM', 'SPONSORS')
    hosting_leagues = RelationshipTo('leagues.models.LEAGUE', 'HOSTS')
    hosting_activities = RelationshipTo('activities.models.ACTIVITY', 'HOSTS')
    image_url = StringProperty()

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'organizations'
