from django_neomodel import DjangoNode
from neomodel import (StringProperty, UniqueIdProperty, One, RelationshipTo,RelationshipFrom,ZeroOrOne)
from neomodel.contrib.spatial_properties import (PointProperty)

class LOCATION(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    points = PointProperty(crs='wgs-84')
    city = RelationshipTo('cities.models.CITY', 'IS_IN', cardinality=One)
    activities = RelationshipFrom('activities.models.ACTIVITY', 'HAPPENS_AT')
    users = RelationshipFrom('users.models.USER', 'BASED_IN', cardinality=ZeroOrOne)
    organizations = RelationshipFrom('organizations.models.ORGANIZATION', 'LOCATED_AT')
    facilities = RelationshipTo('categories.models.CATEGORY', 'HAS_FACILITY')
    teams = RelationshipFrom('teams.models.TEAM', 'BASED_IN', cardinality=ZeroOrOne)
    
    def __str__(self):
        return self.name
    class Meta:
        app_label = 'locations'