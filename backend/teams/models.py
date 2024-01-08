from django.db import models
from neomodel import (StringProperty, IntegerProperty, DateTimeProperty, StructuredRel,RelationshipFrom, BooleanProperty,UniqueIdProperty, RelationshipTo, One)
from django_neomodel import DjangoNode
from competitions.models import Team_Score

class JoinedTeamRel(StructuredRel):
    joined_at = DateTimeProperty(default_now=True)
    player_number = IntegerProperty(required=True,unique=True)
    name_on_jersey = StringProperty(required=True)
    plays_for_division = IntegerProperty(required=True)

class Since(StructuredRel):
    since = DateTimeProperty(default_now=True)
    def __str__(self):
        return self.since
    


# Create your models here.
class TEAM(DjangoNode):
    name = StringProperty(required=True, unique_index=True)
    men_team = BooleanProperty(default=True)
    founded_at = DateTimeProperty(default_now=True)
    belongs_to_organization = RelationshipFrom('organizations.models.ORGANIZATION', 'HAS')   
    sponsors = RelationshipFrom('organizations.models.ORGANIZATION', 'SPONSORS',model=Since)
<<<<<<< HEAD
    members = RelationshipFrom('users.models.USER', 'IS_MEMBER_OF',model=JoinedTeamRel)  
=======
    members = RelationshipFrom('users.models.USER', 'IS_MEMBER_OF',model=JoinedTeamRel)
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
    roles = RelationshipFrom('roles.models.ROLE', 'IN')
    category = RelationshipTo('categories.models.CATEGORY', 'IS_TYPE_OF')
    competitions_as_team_1 = RelationshipFrom('competitions.models.COMPETITION', 'TEAM_1')
    competitions_as_team_2 = RelationshipFrom('competitions.models.COMPETITION', 'TEAM_2')
    competitions_as_winner = RelationshipFrom('competitions.models.COMPETITION', 'WON_BY')
    made_substitutions = RelationshipTo('substitutions.models.SUBSTITUTION', 'MADE')
<<<<<<< HEAD
    requests_to_join = RelationshipFrom('requests_model.models.REQUEST', 'TO_JOIN')
    friendly_game_requests_from = RelationshipFrom('requests_model.models.REQUEST', 'SENDS_FRIENDLY_GAME')
    friendly_game_requests_to = RelationshipTo('requests_model.models.REQUEST', 'TO_PLAY_WITH')
=======
    requests_to_join = RelationshipFrom('requests.models.REQUEST', 'TO_JOIN')
    friendly_game_requests_from = RelationshipFrom('requests.models.REQUEST', 'SENDS_FRIENDLY_GAME')
    friendly_game_requests_to = RelationshipTo('requests.models.REQUEST', 'TO_PLAY_WITH')
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
    scores_history = RelationshipFrom('score_infos.models.SCORE_INFO', 'SCORED_BY')
    tshirt_color = RelationshipTo('colors.models.COLOR', 'TSHIRT_COLOR')
    shorts_color = RelationshipTo('colors.models.COLOR', 'SHORTS_COLOR')
    socks_color = RelationshipTo('colors.models.COLOR', 'SOCKS_COLOR')
    participated_leagues = RelationshipTo('activities.models.ACTIVITY', 'PARTICIPATES_IN')
<<<<<<< HEAD
    location = RelationshipTo('locations.models.LOCATION', 'BASED_IN')
=======
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
    def __str__(self):
        return self.name
    class Meta:
        app_label = 'teams'

    
#generate a team with dummy data
#team = Team(name='Beijing Rockets', description='Rockets Football Club', jersey_colors='Black and White').save()

#rel = user1.teams.connect(team,{'role': 'Player', 'player_number': 95, 'name_on_jersey': 'Rockets'})