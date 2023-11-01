from django.db import models
from neomodel import (StringProperty, IntegerProperty, DateTimeProperty, StructuredRel,RelationshipFrom)
from django_neomodel import DjangoNode

class JoinedTeamRel(StructuredRel):
    joined_at = DateTimeProperty(default_now=True)
    role = StringProperty(default='Player')
    player_number = IntegerProperty(required=True,unique=True)
    name_on_jersey = StringProperty(required=True)
    division = IntegerProperty(required=True)

# Create your models here.
class Team(DjangoNode):
    name = StringProperty(required=True)
    description = StringProperty(required=True)
    founded_at = DateTimeProperty(default_now=True)
    jersey_colors = StringProperty(required=True)
    founder = RelationshipFrom('users.models.User', 'FOUNDER_OF')
    def __str__(self):
        return self.name
    class Meta:
        app_label = 'teams'

    
#generate a team with dummy data
#team = Team(name='Beijing Rockets', description='Rockets Football Club', jersey_colors='Black and White').save()

#rel = user1.teams.connect(team,{'role': 'Player', 'player_number': 95, 'name_on_jersey': 'Rockets'})