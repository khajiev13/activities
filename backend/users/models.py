from neomodel import ( StringProperty, IntegerProperty,
    UniqueIdProperty, Relationship, DateTimeProperty, EmailProperty)
from django_neomodel import DjangoNode

class User(DjangoNode):
    uid = UniqueIdProperty()
    friends = Relationship('User', 'FRIEND')
    activities = Relationship('activities.models.Activity', 'JOINED')

    #Person.nodes.get(uid='a12df...')
    first_name = StringProperty(required=True)
    last_name = StringProperty(required=True)
    age = IntegerProperty(required=True)
    created_at = DateTimeProperty(default_now=True)
    email = EmailProperty()
    gender = StringProperty(required=True)
    points = IntegerProperty(default=0)
    # ROLES = {
    #     'COA': 'Coach',
    #     'PLA': 'Player',
    #     'SPE': 'Spectator',
    #     'REF': 'Referee',
    #     'ORG': 'Organizer',
    #     'MAN': 'Manager',
    #     'TRA': 'Trainer',
    #     'TEA': 'Teacher',
    #     'PAR': 'Participant',
    # }
    role = StringProperty(default='Spectator')
    # hobbies = RelationshipTo('Hobby', 'LIKES')
    # location = RelationshipTo('Location', 'LOCATED_AT')


    # tim = Person(sex='M').save()
    # tim.sex # M
    # tim.get_sex_display() # 'Male'
    #medals

    class Meta:
        app_label = 'users'