from neomodel import (StringProperty, One, RelationshipTo, RelationshipFrom, ZeroOrOne)
from django_neomodel import DjangoNode

class STATE(DjangoNode): 
    name = StringProperty(required=True, unique_index=True)
    country = RelationshipTo('countries.models.COUNTRY', 'IS_IN')
    users = RelationshipFrom('users.models.USER', 'IS_FROM')
    cities = RelationshipFrom('cities.models.CITY', 'IS_IN')
    teams = RelationshipFrom('teams.models.TEAM', 'STATE_BASED_IN')
    organizations = RelationshipFrom('organizations.models.ORGANIZATION', 'STATE_BASED_IN')
    activities = RelationshipFrom('activities.models.ACTIVITY', 'STATE_BASED_IN')
    def __str__(self):
        return self.name

    class Meta:
        app_label = 'states'