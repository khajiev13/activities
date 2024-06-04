from neomodel import (StringProperty, UniqueIdProperty, One, RelationshipTo, RelationshipFrom, ZeroOrOne)
from django_neomodel import DjangoNode

class CITY(DjangoNode):
    name = StringProperty(required=True, unique_index=True)
    state = RelationshipTo('states.models.STATE', 'IS_IN', cardinality=One)
    locations = RelationshipFrom('locations.models.LOCATION', 'IS_IN', cardinality=One)
    users = RelationshipFrom('users.models.USER', 'IS_FROM')
    leagues = RelationshipFrom('leagues.models.LEAGUE', 'CITY_BASED_IN')
    activities = RelationshipFrom('activities.models.ACTIVITY', 'CITY_BASED_IN')
    teams = RelationshipFrom('teams.models.TEAM', 'CITY_BASED_IN')
    organizations = RelationshipFrom('organizations.models.ORGANIZATION', 'CITY_BASED_IN')
    def __str__(self):
            return self.name
    class Meta:
        app_label = 'cities'