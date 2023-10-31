from django.db import models
from neomodel import (StructuredNode, StringProperty, IntegerProperty,
    UniqueIdProperty, RelationshipTo, DateTimeProperty, BooleanProperty)

# Create your models here.
class Team(StructuredNode):
    name = StringProperty(required=True)
    description = StringProperty(required=True)
    created_at = DateTimeProperty(default_now=True)
    #organizer = Link it to the User model
    