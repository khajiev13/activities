from neomodel import (StringProperty, BooleanProperty, UniqueIdProperty, RelationshipFrom,IntegerProperty, One, StructuredRel)
from django_neomodel import DjangoNode
from django.core.exceptions import ValidationError

class Users_Category_Statistics(StructuredRel):
    points_earned = IntegerProperty(default=0)


class CATEGORY(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    is_indoor = BooleanProperty(required=True)
    is_outdoor = BooleanProperty(required=True)
    is_online = BooleanProperty(required=True)
    locations = RelationshipFrom('locations.models.LOCATION', 'HAS_FACILITY')
    teams = RelationshipFrom('teams.models.TEAM', 'IS_TYPE_OF')
    leagues = RelationshipFrom('leagues.models.LEAGUE', 'IS_TYPE_OF', cardinality=One)
    activities = RelationshipFrom('activities.models.ACTIVITY', 'IS_TYPE_OF')
    users = RelationshipFrom('users.models.USER', 'LIKES')
    achievements = RelationshipFrom('achievements.models.ACHIEVEMENT', 'IN')
    roles = RelationshipFrom('roles.models.ROLE', 'SPECIALIZED_IN')
    users_with_statistics = RelationshipFrom('users.models.USER', 'HAS_STATISTICS_IN', model=Users_Category_Statistics)
    
    def save(self, *args, **kwargs):
        if self.is_indoor and self.is_outdoor:
            raise ValidationError("Only one of is_indoor or is_outdoor can be True.")
        super(CATEGORY, self).save(*args, **kwargs)

    def __str__(self):
            return self.name
    class Meta:
        app_label = 'categories'