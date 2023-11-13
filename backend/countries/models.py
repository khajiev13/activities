from neomodel import (StringProperty, UniqueIdProperty,RelationshipFrom,One)
from django_neomodel import DjangoNode

class COUNTRY(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    cities = RelationshipFrom('cities.models.CITY', 'IS_IN', cardinality=One)
    users = RelationshipFrom('users.models.USER', 'IS_FROM')
    def __str__(self):
            return self.name
    
    class Meta:
        app_label = 'countries'