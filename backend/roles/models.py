from django.db import models
from neomodel import (StringProperty, UniqueIdProperty,
                      RelationshipFrom, RelationshipTo)
from django_neomodel import DjangoNode
# Create your models here.


class ROLE(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    users = RelationshipFrom('users.models.USER', 'IS')
    specialized_in = RelationshipTo(
        'categories.models.CATEGORY', 'SPECIALIZED_IN')
    in_team = RelationshipTo('teams.models.TEAM', 'IN')
    for_activity = RelationshipTo('activities.models.ACTIVITY', 'FOR')

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'roles'
