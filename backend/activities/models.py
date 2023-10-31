from neomodel import (StructuredNode, StringProperty, IntegerProperty,
    UniqueIdProperty, RelationshipTo, DateTimeProperty, BooleanProperty)
from django_neomodel import DjangoNode

class Activity(DjangoNode):
    uid = UniqueIdProperty()
    title = StringProperty(required=True)
    description = StringProperty(required=True)
    created_at = DateTimeProperty(default_now=True)
    #organizer = Link it to the User model
    duration = IntegerProperty(required=True) 
    public = BooleanProperty(default=True)
    date_time = DateTimeProperty(required=True,format="%Y-%m-%d %H:%M:%S")
    class Meta:
        app_label = 'activities'
