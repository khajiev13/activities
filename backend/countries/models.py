from neomodel import (StringProperty,RelationshipFrom,One, ZeroOrOne)
from django_neomodel import DjangoNode

class COUNTRY(DjangoNode):
    name = StringProperty(required=True, unique_index=True)
    states = RelationshipFrom('states.models.STATE', 'IS_IN')  # changed from cities to states
    users = RelationshipFrom('users.models.USER', 'IS_FROM')
    teams = RelationshipFrom('teams.models.TEAM', 'BASED_IN', cardinality=ZeroOrOne)
    activities = RelationshipFrom('activities.models.ACTIVITY', 'BASED_IN', cardinality=ZeroOrOne)
    def __str__(self):
            return self.name
    
    class Meta:
        app_label = 'countries'