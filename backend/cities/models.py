from neomodel import (StringProperty, UniqueIdProperty, One, RelationshipTo, RelationshipFrom)
from django_neomodel import DjangoNode

class CITY(DjangoNode):
    name = StringProperty(required=True, unique_index=True)
    state = RelationshipTo('states.models.STATE', 'IS_IN', cardinality=One)
    locations = RelationshipFrom('locations.models.LOCATION', 'IS_IN')
    leagues = RelationshipFrom('leagues.models.LEAGUE', 'HAPPENS_IN')
    def __str__(self):
            return self.name
    class Meta:
        app_label = 'cities'