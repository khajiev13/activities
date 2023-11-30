class ACHIEVEMENT(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    description = StringProperty(required=True)
    picture_url = StringProperty(required=True)
    during = RelationshipTo('activities.models.ACTIVITY', 'DURING')
    category = RelationshipTo('categories.models.CATEGORY', 'IN',cardinality=ZeroOrOne)
    owner = RelationshipFrom('users.models.USER', 'ACHIEVED')
    def __str__(self):
            return self.name
    class Meta:
        app_label = 'achievements'

class ACTIVITY(DjangoNode):
    pk = UniqueIdProperty()
    title = StringProperty(required=True, unique=True)
    description = StringProperty(required=True)
    duration_in_minutes = IntegerProperty(required=True) 
    public = BooleanProperty(default=True)
    date_time = DateTimeProperty(required=True,format="%Y-%m-%d %H:%M:%S")
    location = RelationshipTo('locations.models.LOCATION', 'HAPPENS_AT')
    people_joined = RelationshipFrom('users.models.USER', 'JOINS')
    creator = RelationshipFrom('users.models.USER', 'CREATES')
    category = RelationshipTo('categories.models.CATEGORY', 'IS_TYPE_OF')
    is_competition = RelationshipTo('competitions.models.COMPETITION', 'IS')
    achievements_earned = RelationshipFrom('achievements.models.ACHIEVEMENT', 'DURING')
    requests_to_join = RelationshipFrom('requests.models.REQUEST', 'TO_JOIN')
    roles = RelationshipFrom('roles.models.ROLE', 'FOR')
    def __str__(self):
        return self.title
    
    class Meta:
        app_label = 'activities'


class Users_Category_Statistics(StructuredRel):
    points_earned = IntegerProperty(default=0)


class CATEGORY(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True, unique=True)
    is_indoor = BooleanProperty(default=True)
    is_outdoor = BooleanProperty(default=True)
    locations = RelationshipFrom('locations.models.LOCATION', 'HAS_FACILITY')
    teams = RelationshipFrom('teams.models.TEAM', 'IS_TYPE_OF', cardinality=One)
    leagues = RelationshipFrom('leagues.models.LEAGUE', 'IS_TYPE_OF', cardinality=One)
    activities = RelationshipFrom('activities.models.ACTIVITY', 'IS_TYPE_OF')
    users = RelationshipFrom('users.models.USER', 'LIKES')
    achievements = RelationshipFrom('achievements.models.ACHIEVEMENT', 'IN')
    roles = RelationshipFrom('roles.models.ROLE', 'SPECIALIZED_IN')
    users_with_statistics = RelationshipFrom('users.models.USER', 'HAS_STATISTICS_IN', model=Users_Category_Statistics)
    def __str__(self):
            return self.name
    class Meta:
        app_label = 'categories'

class CITY(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True, unique_index=True)
    country = RelationshipTo('countries.models.COUNTRY', 'IS_IN', cardinality=One)
    locations = RelationshipFrom('locations.models.LOCATION', 'IS_IN')
    leagues = RelationshipFrom('leagues.models.LEAGUE', 'HAPPENS_IN')
    def __str__(self):
            return self.name
    class Meta:
        app_label = 'cities'

class COLOR(DjangoNode):
    name = StringProperty(required=True, unique=True, unique_index=True) 
    teams_tshirt = RelationshipFrom('teams.models.TEAM', 'TSHIRT_COLOR')
    teams_socks = RelationshipFrom('teams.models.TEAM', 'SOCKS_COLOR')
    teams_shorts = RelationshipFrom('teams.models.TEAM', 'SHORTS_COLOR')
    def __str__(self):
            return self.name
    class Meta:
        app_label = 'colors'

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
    
class COUNTRY(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    cities = RelationshipFrom('cities.models.CITY', 'IS_IN', cardinality=One)
    users = RelationshipFrom('users.models.USER', 'IS_FROM')
    def __str__(self):
            return self.name
    
    class Meta:
        app_label = 'countries'

class LEAGUE(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    description = StringProperty(required=True)
    start_date = DateProperty(required=True)
    end_date = DateProperty(required=True)
    hosting_organization = RelationshipFrom('organizations.models.ORGANIZATION', 'HOSTS')
    participating_users = RelationshipFrom('users.models.USER', 'PARTICIPATES_IN')
    category = RelationshipTo('categories.models.CATEGORY', 'IS_TYPE_OF')
    city = RelationshipTo('cities.models.CITY', 'HAPPENS_IN')
    competitions = RelationshipTo('competitions.models.COMPETITION', 'HAS')
    participating_teams = RelationshipFrom('teams.models.TEAM', 'PARTICIPATES_IN')
    def __str__(self):
        return self.name
    class Meta:
        app_label = 'leagues'
    
class LOCATION(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    points = PointProperty(crs='wgs-84')
    city = RelationshipTo('cities.models.CITY', 'IS_IN', cardinality=One)
    activities = RelationshipFrom('activities.models.ACTIVITY', 'HAPPENS_AT')
    users = RelationshipFrom('users.models.USER', 'BASED_IN', cardinality=ZeroOrOne)
    organizations = RelationshipFrom('organizations.models.ORGANIZATION', 'LOCATED_AT')
    facilities = RelationshipTo('categories.models.CATEGORY', 'HAS_FACILITY')
    
    def __str__(self):
        return self.name
    class Meta:
        app_label = 'locations'

class ORGANIZATION(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    created_at = DateProperty(default_now=True)
    join_requests = RelationshipFrom('requests.models.REQUEST', 'TO_JOIN')
    location = RelationshipTo('locations.models.LOCATION', 'LOCATED_AT')
    members = RelationshipFrom('users.models.USER', 'BELONGS_TO',model=Since)
    founder = RelationshipFrom('users.models.USER', 'CREATES')
    sponsors = RelationshipFrom('users.models.USER', 'SPONSORS',model=Since)
    teams = RelationshipTo('teams.models.TEAM', 'HAS_TEAM')
    hosting_leagues = RelationshipTo('activities.models.ACTIVITY', 'HOSTS')
    
    def __str__(self):
        return self.name
    class Meta:
        app_label = 'organizations'

class REQUEST(DjangoNode):
    pk = UniqueIdProperty()
    accepted = BooleanProperty(default=False)
    rejected = BooleanProperty(default=False)
    pending = BooleanProperty(default=True)
    time = DateTimeProperty(default_now=True)
    sender_message = StringProperty()
    receiver_message = StringProperty()
    welcomed_rejected_message = StringProperty()
    activity = RelationshipTo('activities.models.ACTIVITY', 'TO_JOIN')
    from_user = RelationshipFrom('users.models.USER', 'SENDS')
    to_user = RelationshipTo('users.models.USER', 'SENT_TO')
    to_join_organization = RelationshipTo('organizations.models.ORGANIZATION', 'TO_JOIN')
    to_join_team = RelationshipTo('teams.models.TEAM', 'TO_JOIN')
    friendly_game_request_from = RelationshipFrom('teams.models.TEAM', 'SENDS_FRIENDLY_GAME')
    friendly_game_request_to = RelationshipTo('teams.models.TEAM', 'TO_PLAY_WITH')
    def __str__(self):
        return self.accepted
    class Meta:
        app_label = 'requests'

class ROLE(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    users = RelationshipFrom('users.models.USER', 'IS')
    specialized_in = RelationshipTo('categories.models.CATEGORY', 'SPECIALIZED_IN')
    in_team = RelationshipTo('teams.models.TEAM', 'IN')
    for_competition = RelationshipTo('competitions.models.COMPETITION', 'FOR')
    for_activity = RelationshipTo('activities.models.ACTIVITY', 'FOR')
    
    def __str__(self):
        return self.name
    class Meta:
        app_label = 'roles'

class SCORE_INFO(DjangoNode):
    pk = UniqueIdProperty()
    time = DateProperty(required=True)
    video_url = StringProperty(required=True)
    body_part_used = StringProperty(required=True)
    description = StringProperty(required=True)
    competition = RelationshipFrom('competitions.models.COMPETITION', 'HAS')
    scored_by_team = RelationshipTo('teams.models.TEAM', 'SCORED_BY')
    scored_by_user = RelationshipTo('users.models.USER', 'SCORED_BY')
    assisted_by_user = RelationshipTo('users.models.USER', 'ASSISTED_BY')
    def __str__(self):
        return self.date
    class Meta:
        app_label = 'score_infos'

class SUBSTITUTION(DjangoNode):
    pk = UniqueIdProperty()
    date = DateProperty(required=True)
    went_in_user = RelationshipTo('users.models.USER', 'WENT_IN')
    went_out_user = RelationshipTo('users.models.USER', 'WENT_OUT')
    competition = RelationshipFrom('competitions.models.COMPETITION', 'HAS')
    team = RelationshipFrom('teams.models.TEAM', 'MADE')
    def __str__(self):
        return self.date
    class Meta:
        app_label = 'substitutions'


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
    members = RelationshipFrom('users.models.USER', 'IS_MEMBER_OF',model=JoinedTeamRel)
    roles = RelationshipFrom('roles.models.ROLE', 'IN')
    category = RelationshipTo('categories.models.CATEGORY', 'IS_TYPE_OF')
    competitions_as_team_1 = RelationshipFrom('competitions.models.COMPETITION', 'TEAM_1')
    competitions_as_team_2 = RelationshipFrom('competitions.models.COMPETITION', 'TEAM_2')
    competitions_as_winner = RelationshipFrom('competitions.models.COMPETITION', 'WON_BY')
    made_substitutions = RelationshipTo('substitutions.models.SUBSTITUTION', 'MADE')
    requests_to_join = RelationshipFrom('requests.models.REQUEST', 'TO_JOIN')
    friendly_game_requests_from = RelationshipFrom('requests.models.REQUEST', 'SENDS_FRIENDLY_GAME')
    friendly_game_requests_to = RelationshipTo('requests.models.REQUEST', 'TO_PLAY_WITH')
    scores_history = RelationshipFrom('score_infos.models.SCORE_INFO', 'SCORED_BY')
    tshirt_color = RelationshipTo('colors.models.COLOR', 'TSHIRT_COLOR')
    shorts_color = RelationshipTo('colors.models.COLOR', 'SHORTS_COLOR')
    socks_color = RelationshipTo('colors.models.COLOR', 'SOCKS_COLOR')
    participated_leagues = RelationshipTo('activities.models.ACTIVITY', 'PARTICIPATES_IN')
    def __str__(self):
        return self.name
    class Meta:
        app_label = 'teams'

    
class USER(DjangoNode):
    username = StringProperty(required=True, unique_index=True, primary_key=True)
    password = StringProperty()
    is_active = BooleanProperty(default=True)
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
    
    @property
    def pk(self):
        return self.username
    @property
    def is_authenticated(self):
        """
        Always return True. This is a way to tell if the user has been
        authenticated in templates.
        """
        return True
        
    def get_session_auth_hash(self):
        """
        Return an HMAC of the password field.
        """
        key_salt = "django.contrib.auth.models.AbstractBaseUser.get_session_auth_hash"
        return salted_hmac(key_salt, self.password).hexdigest()
    
    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password)
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

