from neomodel import (StringProperty, One, RelationshipTo, RelationshipFrom, ZeroOrOne)
from django_neomodel import DjangoNode

class STATE(DjangoNode): 
    name = StringProperty(required=True, unique_index=True)
    country = RelationshipTo('countries.models.COUNTRY', 'IS_IN', cardinality=One)
    cities = RelationshipFrom('cities.models.CITY', 'IS_IN')
    teams = RelationshipFrom('teams.models.TEAM', 'BASED_IN', cardinality=ZeroOrOne)

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'states'