from neomodel import (StructuredNode, StringProperty, IntegerProperty,
    UniqueIdProperty, RelationshipTo, DateTimeProperty, BooleanProperty,StructuredRel)
from django_neomodel import DjangoNode

class JoinedActRel(StructuredRel):
    joined_at = DateTimeProperty(default_now=True)
    role = StringProperty(default='Participant')

class Activity(DjangoNode):
    uid = UniqueIdProperty()
    title = StringProperty(required=True)
    description = StringProperty(required=True)
    created_at = DateTimeProperty(default_now=True)
    #organizer = Link it to the User model
    duration = IntegerProperty(required=True) 
    public = BooleanProperty(default=True)
    date_time = DateTimeProperty(required=True,format="%Y-%m-%d %H:%M:%S")
    
    def __str__(self):
        return self.title
    
    class Meta:
        app_label = 'activities'


#activity = Activity(title='Football', description='Football game', duration=90, date_time='2018-12-12 12:00:00').save()
# activity2 = Activity(title='Basketball', description='Basketball game', duration=90, date_time='2018-12-12 12:00:00').save()
# activity3 = Activity(title='Tennis', description='Tennis game', duration=90, date_time='2018-12-12 12:00:00').save()
# activity4 = Activity(title='Volleyball', description='Volleyball game', duration=90, date_time='2018-12-12 12:00:00').save()
# activity5 = Activity(title='Baseball', description='Baseball game', duration=90, date_time='2018-12-12 12:00:00').save()