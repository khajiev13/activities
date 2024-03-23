from neomodel import (StringProperty, UniqueIdProperty, One, RelationshipTo, RelationshipFrom, ZeroOrOne)
from django_neomodel import DjangoNode

class CITY(DjangoNode):
    name = StringProperty(required=True, unique_index=True)
    state = RelationshipTo('states.models.STATE', 'IS_IN', cardinality=One)
    locations = RelationshipFrom('locations.models.LOCATION', 'IS_IN', cardinality=One)
    leagues = RelationshipFrom('leagues.models.LEAGUE', 'BASED_IN')
    activities = RelationshipFrom('activities.models.ACTIVITY', 'BASED_IN', cardinality=ZeroOrOne)
    teams = RelationshipFrom('teams.models.TEAM', 'BASED_IN', cardinality=ZeroOrOne)
    def __str__(self):
            return self.name
    class Meta:
        app_label = 'cities'