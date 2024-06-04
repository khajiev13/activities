from neomodel import (StringProperty,RelationshipFrom,One, ZeroOrOne)
from django_neomodel import DjangoNode

class COUNTRY(DjangoNode):
    name = StringProperty(required=True, unique_index=True)
    states = RelationshipFrom('states.models.STATE', 'IS_IN') 
    users = RelationshipFrom('users.models.USER', 'IS_FROM')
    teams = RelationshipFrom('teams.models.TEAM', 'COUNTRY_BASED_IN')
    activities = RelationshipFrom('activities.models.ACTIVITY', 'BASED_IN')
    organizations = RelationshipFrom('organizations.models.ORGANIZATION', 'COUNTRY_BASED_IN',)
    def __str__(self):
            return self.name
    
    class Meta:
        app_label = 'countries'