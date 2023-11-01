from neomodel import ( StringProperty, IntegerProperty,
    UniqueIdProperty, Relationship, DateTimeProperty, EmailProperty, RelationshipTo)
from django_neomodel import DjangoNode
from activities.models import JoinedActRel
from teams.models import JoinedTeamRel

class User(DjangoNode):
    uid = IntegerProperty(index=True, unique=True)
    friends = Relationship('User', 'FRIEND')
    activities = Relationship('activities.models.Activity', 'JOINED', model=JoinedActRel)
    teams = RelationshipTo('teams.models.Team', 'IS_A_MEMBER_OF', model=JoinedTeamRel)
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
    def __str__(self):
        return self.first_name

    class Meta:
        app_label = 'users'




# user1 = User(first_name='Roma', last_name='Khajiev', age=23, email='roma@example.com', gender='Male', points=100, role='Player')
# user2 = User(first_name='Mohamed', last_name='Amour', age=23, email='roma@example.com', gender='Male', points=100, role='Player')
#activity = Activity.nodes.filter(title='Football').first()
# rel = user1.activities.connect(activity,{'role': 'Player'})