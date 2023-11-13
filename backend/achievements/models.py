from neomodel import (StringProperty, UniqueIdProperty,RelationshipFrom, RelationshipTo, ZeroOrOne)
from django_neomodel import DjangoNode

class ACHIEVEMENT(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    description = StringProperty(required=True)
    picture_url = StringProperty(required=True)
    during = RelationshipTo('activities.models.ACTIVITY', 'DURING')
    category = RelationshipTo('categories.models.CATEGORY', 'IN',cardinality=ZeroOrOne)
    owner = RelationshipFrom('users.models.USER', 'ACHIEVED')
    def __str__(self):
            return self.name
    class Meta:
        app_label = 'achievements'