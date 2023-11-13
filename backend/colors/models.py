from neomodel import (StringProperty, UniqueIdProperty,RelationshipFrom)
from django_neomodel import DjangoNode

class COLOR(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True, unique=True) 
    teams_tshirt = RelationshipFrom('teams.models.TEAM', 'TSHIRT_COLOR')
    teams_socks = RelationshipFrom('teams.models.TEAM', 'SOCKS_COLOR')
    teams_shorts = RelationshipFrom('teams.models.TEAM', 'SHORTS_COLOR')
    def __str__(self):
            return self.name
    class Meta:
        app_label = 'colors'