from django.db import models
from neomodel import (StringProperty, IntegerProperty, DateProperty, StructuredRel,
                      RelationshipFrom, BooleanProperty, UniqueIdProperty, RelationshipTo, One, ZeroOrOne)
from django_neomodel import DjangoNode
from competitions.models import Team_Score


class JoinedTeamRel(StructuredRel):
    joined_at = DateProperty(default_now=True)
    player_number = IntegerProperty(required=True, unique=True)
    name_on_jersey = StringProperty(required=True)
    plays_for_division = IntegerProperty(required=True)


class Since(StructuredRel):
    since = DateProperty(default_now=True)

    def __str__(self):
        return self.since


# Create your models here.
class TEAM(DjangoNode):
    name = StringProperty(required=True, unique_index=True)
    men_team = BooleanProperty(default=True)
    founded_at = DateProperty(default_now=True)
    location = RelationshipTo(
        'locations.models.LOCATION', 'BASED_IN)', cardinality=ZeroOrOne)
    city_name = RelationshipTo(
        'cities.models.CITY', 'CITY_BASED_IN', cardinality=ZeroOrOne)
    state_name = RelationshipTo(
        'states.models.STATE', 'STATE_BASED_IN', cardinality=ZeroOrOne)
    country_name = RelationshipTo(
        'countries.models.COUNTRY', 'COUNTRY_BASED_IN', cardinality=ZeroOrOne)
    belongs_to_organization = RelationshipFrom(
        'organizations.models.ORGANIZATION', 'HAS')
    sponsors = RelationshipFrom(
        'organizations.models.ORGANIZATION', 'SPONSORS', model=Since)
    members = RelationshipFrom(
        'users.models.USER', 'IS_MEMBER_OF', model=JoinedTeamRel)
    roles = RelationshipFrom('roles.models.ROLE', 'IN')
    categories = RelationshipTo(
        'categories.models.CATEGORY', 'IS_TYPE_OF', cardinality=One)
    competitions_as_team_1 = RelationshipFrom(
        'competitions.models.COMPETITION', 'TEAM_1')
    competitions_as_team_2 = RelationshipFrom(
        'competitions.models.COMPETITION', 'TEAM_2')
    competitions_as_winner = RelationshipFrom(
        'competitions.models.COMPETITION', 'WON_BY')
    made_substitutions = RelationshipTo(
        'substitutions.models.SUBSTITUTION', 'MADE')
    requests_to_join = RelationshipFrom(
        'join_requests.models.REQUEST', 'TO_JOIN')
    friendly_game_requests_from = RelationshipFrom(
        'join_requests.models.REQUEST', 'SENDS_FRIENDLY_GAME')
    friendly_game_requests_to = RelationshipTo(
        'join_requests.models.REQUEST', 'TO_PLAY_WITH')
    scores_history = RelationshipFrom(
        'score_infos.models.SCORE_INFO', 'SCORED_BY')
    tshirt_color = RelationshipTo('colors.models.COLOR', 'TSHIRT_COLOR')
    shorts_color = RelationshipTo('colors.models.COLOR', 'SHORTS_COLOR')
    socks_color = RelationshipTo('colors.models.COLOR', 'SOCKS_COLOR')
    away_tshirt_color = RelationshipTo(
        'colors.models.COLOR', 'AWAY_TSHIRT_COLOR')
    participated_leagues = RelationshipTo(
        'leagues.models.LEAGUE', 'PARTICIPATES_IN')
    participated_activities = RelationshipTo(
        'activities.models.ACTIVITY', 'PARTICIPATES_IN')
    image_url = StringProperty()
    public_team = BooleanProperty(default=False)

    # We need this function because django neomodel does not support unique properties

    def element_id_property(self):
        return self.name

    def join_leave_team_toggle(self, user):
        if self.members.is_connected(user):
            # If the user is already a member, disconnect them
            self.members.disconnect(user)
            return False  # Indicates the user has left the team
        else:
            # If the user is not a member, connect them
            self.members.connect(user)
            return True  # Indicates the user has joined the team

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'teams'


# generate a team with dummy data
# team = Team(name='Beijing Rockets', description='Rockets Football Club', jersey_colors='Black and White').save()

# rel = user1.teams.connect(team,{'role': 'Player', 'player_number': 95, 'name_on_jersey': 'Rockets'})
