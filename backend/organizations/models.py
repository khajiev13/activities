from django_neomodel import DjangoNode
from neomodel import (StringProperty, UniqueIdProperty, RelationshipFrom, RelationshipTo,StructuredRel, DateProperty)
from teams.models import Since

class ORGANIZATION(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    created_at = DateProperty(default_now=True)
    join_requests = RelationshipFrom('requests.models.REQUEST', 'TO_JOIN')
    location = RelationshipTo('locations.models.LOCATION', 'LOCATED_AT')
    members = RelationshipFrom('users.models.USER', 'BELONGS_TO',model=Since)
    founder = RelationshipFrom('users.models.USER', 'CREATES')
    sponsors = RelationshipFrom('users.models.USER', 'SPONSORS',model=Since)
    teams = RelationshipTo('teams.models.TEAM', 'HAS_TEAM')
    hosting_leagues = RelationshipTo('activities.models.ACTIVITY', 'HOSTS')
    
    def __str__(self):
        return self.name
    class Meta:
        app_label = 'organizations'