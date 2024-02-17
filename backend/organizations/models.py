from django_neomodel import DjangoNode
from neomodel import (StringProperty, UniqueIdProperty, RelationshipFrom, RelationshipTo, DateProperty)
from teams.models import Since
from datetime import date

class ORGANIZATION(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True,max_length=100)
    created_at = DateProperty(default=date.today)
    join_requests = RelationshipFrom('join_requests.models.REQUEST', 'TO_JOIN')
    location = RelationshipTo('locations.models.LOCATION', 'LOCATED_AT')
    members = RelationshipFrom('users.models.USER', 'BELONGS_TO',model=Since)
    founder = RelationshipFrom('users.models.USER', 'CREATES')
    sponsors = RelationshipFrom('users.models.USER', 'SPONSORS',model=Since)
    teams = RelationshipTo('teams.models.TEAM', 'HAS_TEAM')
    hosting_leagues = RelationshipTo('activities.models.ACTIVITY', 'HOSTS')
    hosting_activities = RelationshipTo('activities.models.ACTIVITY', 'HOSTS')
    image_url = StringProperty()
    
    def __str__(self):
        return self.name
    class Meta:
        app_label = 'organizations'