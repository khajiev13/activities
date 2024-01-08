from neomodel import (StructuredNode, StringProperty, IntegerProperty,
    UniqueIdProperty, RelationshipTo, DateTimeProperty, BooleanProperty,StructuredRel, ZeroOrOne, RelationshipFrom)
from django_neomodel import DjangoNode

# class JoinedActRel(StructuredRel):
#     joined_at = DateTimeProperty(default_now=True)
#     role = StringProperty(default='Participant')

class ACTIVITY(DjangoNode):
    pk = UniqueIdProperty()
    title = StringProperty(required=True, unique=True)
    description = StringProperty(required=True)
    duration_in_minutes = IntegerProperty(required=True) 
    public = BooleanProperty(default=True)
    date_time = DateTimeProperty(required=True,format="%Y-%m-%d %H:%M:%S")
    location = RelationshipTo('locations.models.LOCATION', 'HAPPENS_AT')
    people_joined = RelationshipFrom('users.models.USER', 'JOINS')
    creator = RelationshipFrom('users.models.USER', 'CREATES')
    category = RelationshipTo('categories.models.CATEGORY', 'IS_TYPE_OF')
    is_competition = RelationshipTo('competitions.models.COMPETITION', 'IS')
    achievements_earned = RelationshipFrom('achievements.models.ACHIEVEMENT', 'DURING')
<<<<<<< HEAD
    requests_to_join = RelationshipFrom('requests_model.models.REQUEST', 'TO_JOIN')
=======
    requests_to_join = RelationshipFrom('requests.models.REQUEST', 'TO_JOIN')
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
    roles = RelationshipFrom('roles.models.ROLE', 'FOR')
    def __str__(self):
        return self.title
    
    class Meta:
        app_label = 'activities'


#activity = Activity(title='Football', description='Football game', duration=90, date_time='2018-12-12 12:00:00').save()
# activity2 = Activity(title='Basketball', description='Basketball game', duration=90, date_time='2018-12-12 12:00:00').save()
# activity3 = Activity(title='Tennis', description='Tennis game', duration=90, date_time='2018-12-12 12:00:00').save()
# activity4 = Activity(title='Volleyball', description='Volleyball game', duration=90, date_time='2018-12-12 12:00:00').save()
# activity5 = Activity(title='Baseball', description='Baseball game', duration=90, date_time='2018-12-12 12:00:00').save()