from neomodel import (StringProperty,RelationshipFrom,One)
from django_neomodel import DjangoNode

class COUNTRY(DjangoNode):
    name = StringProperty(required=True, unique_index=True)
    states = RelationshipFrom('states.models.STATE', 'IS_IN')  # changed from cities to states
    users = RelationshipFrom('users.models.USER', 'IS_FROM')
    def __str__(self):
            return self.name
    
    class Meta:
        app_label = 'countries'