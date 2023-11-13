from django.db import models
from neomodel import (DateProperty, UniqueIdProperty, RelationshipFrom, RelationshipTo)
from django_neomodel import DjangoNode
# Create your models here.

class SUBSTITUTION(DjangoNode):
    pk = UniqueIdProperty()
    date = DateProperty(required=True)
    went_in_user = RelationshipTo('users.models.USER', 'WENT_IN')
    went_out_user = RelationshipTo('users.models.USER', 'WENT_OUT')
    competition = RelationshipFrom('competitions.models.COMPETITION', 'HAS')
    team = RelationshipFrom('teams.models.TEAM', 'MADE')
    def __str__(self):
        return self.date
    class Meta:
        app_label = 'substitutions'

