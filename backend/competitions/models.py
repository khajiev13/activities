from neomodel import (IntegerProperty, UniqueIdProperty,RelationshipTo, RelationshipFrom, StructuredRel)
from django_neomodel import DjangoNode

class Team_Score(StructuredRel):
    scored_number = IntegerProperty(default=0)

class COMPETITION(DjangoNode):
    pk = UniqueIdProperty()
    first_half_extra_time = IntegerProperty(default=0)
    second_half_extra_time = IntegerProperty(default=0)
    activity = RelationshipFrom('activities.models.ACTIVITY', 'IS')
    league = RelationshipFrom('leagues.models.LEAGUE', 'HAS')
    winning_team = RelationshipTo('teams.models.TEAM', 'WON_BY')
    team_1 = RelationshipTo('teams.models.TEAM', 'TEAM_1', model=Team_Score)
    team_2 = RelationshipTo('teams.models.TEAM', 'TEAM_2', model=Team_Score)
    mvp_player = RelationshipTo('users.models.USER', 'MVP')
    substituitons = RelationshipTo('users.models.USER', 'HAS')
    score_info = RelationshipTo('score_infos.models.SCORE_INFO', 'HAS')
    roles = RelationshipFrom('roles.models.ROLE', 'FOR')
    people_took_part = RelationshipFrom('users.models.USER', 'ç')
    def __str__(self):
        return self.pk
    class Meta:
        app_label = 'competitions'