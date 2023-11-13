from neomodel import ( StringProperty, IntegerProperty,
    UniqueIdProperty, DateTimeProperty, EmailProperty, RelationshipTo, RelationshipFrom)
from django_neomodel import DjangoNode
from teams.models import JoinedTeamRel
from organizations.models import Since
from categories.models import Users_Category_Statistics
from neomodel import db
from teams.models import TEAM
from roles.models import ROLE

class USER(DjangoNode):
    pk = UniqueIdProperty()
    first_name = StringProperty(required=True)
    last_name = StringProperty(required=True)
    age = IntegerProperty(required=True)
    created_at = DateTimeProperty(default_now=True)
    email = EmailProperty()
    gender = StringProperty(required=True)
    followers = RelationshipFrom('users.models.USER', 'FOLLOWS')
    following = RelationshipTo('users.models.USER', 'FOLLOWS')
    hobbies = RelationshipTo('categories.models.CATEGORY', 'LIKES')
    is_from = RelationshipTo('countries.models.COUNTRY', 'IS_FROM')
    based_in = RelationshipTo('locations.models.LOCATION', 'BASED_IN')
    belongs_to_this_organization = RelationshipTo('organizations.models.ORGANIZATION', 'BELONGS_TO', model=Since)
    roles = RelationshipTo('roles.models.ROLE', 'IS')
    teams_joined = RelationshipTo('teams.models.TEAM', 'IS_MEMBER_OF', model=JoinedTeamRel)
    assist_history = RelationshipFrom('score_infos.models.SCORE_INFO', 'ASSISTED_BY')
    score_history = RelationshipFrom('score_infos.models.SCORE_INFO', 'SCORED_BY')
    mvp_history = RelationshipFrom('competitions.models.COMPETITION', 'MVP')
    created_organization = RelationshipTo('organizations.models.ORGANIZATION', 'CREATES')
    leagues_participated = RelationshipTo('leagues.models.LEAGUE', 'PARTICIPATES_IN')
    sent_requests = RelationshipTo('requests.models.REQUEST', 'SENT')
    received_requests = RelationshipFrom('requests.models.REQUEST', 'SENT_TO')
    activities_joined = RelationshipTo('activities.models.ACTIVITY', 'JOINS')
    activities_created = RelationshipTo('activities.models.ACTIVITY', 'CREATES')
    subbed_in = RelationshipFrom('substitutions.models.SUBSTITUTION', 'WENT_IN')
    subbed_out = RelationshipFrom('substitutions.models.SUBSTITUTION', 'WENT_OUT')
    has_statistics_in_category = RelationshipTo('categories.models.CATEGORY', 'HAS_STATISTICS_IN', model=Users_Category_Statistics)
    achievements = RelationshipTo('achievements.models.ACHIEVEMENT', 'ACHIEVED')
    part_of_competition = RelationshipTo('competitions.models.COMPETITION', 'PART_OF_COMPETITION')
    def __str__(self):
        return self.first_name
    def get_roles_and_teams(self):
        query = """
        MATCH m=(user:USER{first_name:$first_name}) -[:IS_MEMBER_OF] ->(team:TEAM)
        WITH team,user
        MATCH (user) -[:IS] ->(role:ROLE)
        WITH role,team,user
        MATCH(role_team:TEAM) <- [:IN] -(role)
        WHERE ID(role_team) = ID(team)
        RETURN role_team, role
        """
        params = {"first_name": self.first_name}
        results, meta = db.cypher_query(query, params)
        role_teams = [TEAM.inflate(row[0]) for row in results]
        roles = [ROLE.inflate(row[1]) for row in results]
        return role_teams, roles
    

    class Meta:
        app_label = 'users'
        verbose_name = 'USER'
