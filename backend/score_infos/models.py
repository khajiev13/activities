from django.db import models
from neomodel import (DateProperty, StringProperty, UniqueIdProperty,RelationshipFrom, RelationshipTo)
from django_neomodel import DjangoNode
# Create your models here.

class SCORE_INFO(DjangoNode):
    pk = UniqueIdProperty()
    time = DateProperty(required=True)
    video_url = StringProperty(required=True)
    body_part_used = StringProperty(required=True)
    description = StringProperty(required=True)
    competition = RelationshipFrom('competitions.models.COMPETITION', 'HAS')
    scored_by_team = RelationshipTo('teams.models.TEAM', 'SCORED_BY')
    scored_by_user = RelationshipTo('users.models.USER', 'SCORED_BY')
    assisted_by_user = RelationshipTo('users.models.USER', 'ASSISTED_BY')
    def __str__(self):
        return self.date
    class Meta:
        app_label = 'score_infos'
