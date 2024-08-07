class ACTIVITY(DjangoNode):
    pk = UniqueIdProperty()
    title = StringProperty(required=True, unique=True)
    description = StringProperty(required=True)
    duration_in_minutes = IntegerProperty(required=True)
    public = BooleanProperty(default=True)
    date_time = DateTimeProperty(required=True)
    time_zone = StringProperty()
    city = RelationshipTo('cities.models.CITY',
                          'BASED_IN', cardinality=ZeroOrOne)
    state = RelationshipTo('states.models.STATE',
                           'BASED_IN', cardinality=ZeroOrOne)
    country = RelationshipTo('countries.models.COUNTRY',
                             'BASED_IN', cardinality=ZeroOrOne)
    location = RelationshipTo('locations.models.LOCATION', 'HAPPENS_AT')
    people_joined = RelationshipFrom('users.models.USER', 'JOINS')
    creator = RelationshipFrom('users.models.USER', 'CREATES')
    categories = RelationshipTo('categories.models.CATEGORY', 'IS_TYPE_OF')
    is_competition = RelationshipTo(
        'competitions.models.COMPETITION', 'IS_COMPETITION')
    achievements_earned = RelationshipFrom(
        'achievements.models.ACHIEVEMENT', 'DURING')
    requests_to_join = RelationshipFrom(
        'join_requests.models.REQUEST', 'TO_JOIN')
    roles = RelationshipFrom('roles.models.ROLE', 'FOR')
    organizer_organization = RelationshipFrom(
        'organizations.models.ORGANIZATION', 'HOSTS')
    teams = RelationshipFrom('teams.models.TEAM', 'PARTICIPATES_IN')

    def list_activities_by_name(self, search_name):
        results, columns = self.cypher(
            "MATCH (activity:ACTIVITY) WHERE activity.title CONTAINS $search_name RETURN activity")
        print([self.inflate(row[0]) for row in results])
        return [self.inflate(row[0]) for row in results]

    def join_activity(self, user):
        self.people_joined.connect(user)

    def __str__(self):
        return self.title

    class Meta:
        app_label = 'activities'


class ACHIEVEMENT(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    description = StringProperty(required=True)
    picture_url = StringProperty(required=True)
    during = RelationshipTo('activities.models.ACTIVITY', 'DURING')
    category = RelationshipTo(
        'categories.models.CATEGORY', 'IN', cardinality=ZeroOrOne)
    owner = RelationshipFrom('users.models.USER', 'ACHIEVED')

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'achievements'


class CATEGORY(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    is_indoor = BooleanProperty(required=True)
    is_outdoor = BooleanProperty(required=True)
    is_online = BooleanProperty(required=True)
    locations = RelationshipFrom('locations.models.LOCATION', 'HAS_FACILITY')
    teams = RelationshipFrom('teams.models.TEAM', 'IS_TYPE_OF')
    leagues = RelationshipFrom(
        'leagues.models.LEAGUE', 'IS_TYPE_OF', cardinality=One)
    activities = RelationshipFrom('activities.models.ACTIVITY', 'IS_TYPE_OF')
    users = RelationshipFrom('users.models.USER', 'LIKES')
    achievements = RelationshipFrom('achievements.models.ACHIEVEMENT', 'IN')
    roles = RelationshipFrom('roles.models.ROLE', 'SPECIALIZED_IN')
    users_with_statistics = RelationshipFrom(
        'users.models.USER', 'HAS_STATISTICS_IN', model=Users_Category_Statistics)

    def save(self, *args, **kwargs):
        if self.is_indoor and self.is_outdoor:
            raise ValidationError(
                "Only one of is_indoor or is_outdoor can be True.")
        super(CATEGORY, self).save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'categories'


class CITY(DjangoNode):
    name = StringProperty(required=True, unique_index=True)
    state = RelationshipTo('states.models.STATE', 'IS_IN', cardinality=One)
    locations = RelationshipFrom(
        'locations.models.LOCATION', 'IS_IN', cardinality=One)
    users = RelationshipFrom('users.models.USER', 'IS_FROM')
    leagues = RelationshipFrom('leagues.models.LEAGUE', 'CITY_BASED_IN')
    activities = RelationshipFrom(
        'activities.models.ACTIVITY', 'CITY_BASED_IN')
    teams = RelationshipFrom('teams.models.TEAM', 'CITY_BASED_IN')
    organizations = RelationshipFrom(
        'organizations.models.ORGANIZATION', 'CITY_BASED_IN')

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'cities'


class COLOR(DjangoNode):
    name = StringProperty(required=True, unique=True, unique_index=True)
    teams_tshirt = RelationshipFrom('teams.models.TEAM', 'TSHIRT_COLOR')
    teams_socks = RelationshipFrom('teams.models.TEAM', 'SOCKS_COLOR')
    teams_shorts = RelationshipFrom('teams.models.TEAM', 'SHORTS_COLOR')
    away_teams_tshirt = RelationshipFrom(
        'teams.models.TEAM', 'AWAY_TSHIRT_COLOR')

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'colors'


class COMPETITION(DjangoNode):
    pk = UniqueIdProperty()
    first_half_extra_time = IntegerProperty(default=0)
    second_half_extra_time = IntegerProperty(default=0)
    activity = RelationshipFrom('activities.models.ACTIVITY', 'IS')
    league = RelationshipFrom('leagues.models.LEAGUE', 'HAS')
    won_by = RelationshipTo('teams.models.TEAM', 'WON_BY')
    team_1 = RelationshipTo('teams.models.TEAM', 'TEAM_1', model=Team_Score)
    team_2 = RelationshipTo('teams.models.TEAM', 'TEAM_2', model=Team_Score)
    mvp_player = RelationshipTo('users.models.USER', 'MVP')
    substituitons = RelationshipTo('competitions.models.SUBSTITUTION', 'HAS')
    score_info = RelationshipTo('score_infos.models.SCORE_INFO', 'HAS')
    roles = RelationshipFrom('roles.models.ROLE', 'FOR')
    people_took_part = RelationshipFrom(
        'users.models.USER', 'PART_OF_COMPETITION')

    def __str__(self):
        return self.pk

    class Meta:
        app_label = 'competitions'


class COUNTRY(DjangoNode):
    name = StringProperty(required=True, unique_index=True)
    states = RelationshipFrom('states.models.STATE', 'IS_IN')
    users = RelationshipFrom('users.models.USER', 'IS_FROM')
    teams = RelationshipFrom('teams.models.TEAM', 'COUNTRY_BASED_IN')
    activities = RelationshipFrom('activities.models.ACTIVITY', 'BASED_IN')
    organizations = RelationshipFrom(
        'organizations.models.ORGANIZATION', 'COUNTRY_BASED_IN',)

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'countries'


class REQUEST(DjangoNode):
    pk = UniqueIdProperty()
    accepted = BooleanProperty(default=False)
    pending = BooleanProperty(default=True)
    time = DateTimeProperty(default_now=True)
    sender_message = StringProperty()
    welcomed_rejected_message = StringProperty()
    to_join_activity = RelationshipTo('activities.models.ACTIVITY', 'TO_JOIN')
    from_user = RelationshipFrom('users.models.USER', 'SENDS')
    to_user = RelationshipTo('users.models.USER', 'SENT_TO')
    to_join_organization = RelationshipTo(
        'organizations.models.ORGANIZATION', 'TO_JOIN')
    to_join_team = RelationshipTo('teams.models.TEAM', 'TO_JOIN')
    friendly_game_request_from = RelationshipFrom(
        'teams.models.TEAM', 'SENDS_FRIENDLY_GAME')
    friendly_game_request_to = RelationshipTo(
        'teams.models.TEAM', 'TO_PLAY_WITH')

    def __str__(self):
        return self.accepted

    class Meta:
        app_label = 'requests'


class LEAGUE(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    description = StringProperty(required=True)
    start_date = DateProperty(required=True)
    end_date = DateProperty(required=True)
    hosting_organizations = RelationshipFrom(
        'organizations.models.ORGANIZATION', 'HOSTS')
    participating_users = RelationshipFrom(
        'users.models.USER', 'PARTICIPATES_IN')
    category = RelationshipTo('categories.models.CATEGORY', 'IS_TYPE_OF')
    city = RelationshipTo('cities.models.CITY', 'BASED_IN')
    state = RelationshipTo('states.models.STATE', 'BASED_IN')
    competitions = RelationshipTo('competitions.models.COMPETITION', 'HAS')
    participating_teams = RelationshipFrom(
        'teams.models.TEAM', 'PARTICIPATES_IN')

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
    users = RelationshipFrom(
        'users.models.USER', 'BASED_IN', cardinality=ZeroOrOne)
    organizations = RelationshipFrom(
        'organizations.models.ORGANIZATION', 'LOCATED_AT')
    facilities = RelationshipTo('categories.models.CATEGORY', 'HAS_FACILITY')
    teams = RelationshipFrom(
        'teams.models.TEAM', 'BASED_IN', cardinality=ZeroOrOne)

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'locations'


class ORGANIZATION(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True, max_length=100, unique_index=True)
    created_at = DateProperty(default=date.today)
    join_requests = RelationshipFrom('join_requests.models.REQUEST', 'TO_JOIN')
    location = RelationshipTo('locations.models.LOCATION', 'LOCATED_AT')
    country = RelationshipTo('countries.models.COUNTRY', 'COUNTRY_BASED_IN')
    state = RelationshipTo('states.models.STATE', 'STATE_BASED_IN')
    city = RelationshipTo('cities.models.CITY', 'CITY_BASED_IN')
    members = RelationshipFrom('users.models.USER', 'BELONGS_TO', model=Since)
    founder = RelationshipFrom('users.models.USER', 'CREATES')
    sponsors = RelationshipFrom('users.models.USER', 'SPONSORS', model=Since)
    teams = RelationshipTo('teams.models.TEAM', 'HAS_TEAM')
    sponsors_teams = RelationshipTo('teams.models.TEAM', 'SPONSORS')
    hosting_leagues = RelationshipTo('leagues.models.LEAGUE', 'HOSTS')
    hosting_activities = RelationshipTo('activities.models.ACTIVITY', 'HOSTS')
    image_url = StringProperty()

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'organizations'


class ROLE(DjangoNode):
    pk = UniqueIdProperty()
    name = StringProperty(required=True)
    users = RelationshipFrom('users.models.USER', 'IS')
    specialized_in = RelationshipTo(
        'categories.models.CATEGORY', 'SPECIALIZED_IN')
    in_team = RelationshipTo('teams.models.TEAM', 'IN')
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


class STATE(DjangoNode):
    name = StringProperty(required=True, unique_index=True)
    country = RelationshipTo('countries.models.COUNTRY', 'IS_IN')
    users = RelationshipFrom('users.models.USER', 'IS_FROM')
    cities = RelationshipFrom('cities.models.CITY', 'IS_IN')
    teams = RelationshipFrom('teams.models.TEAM', 'STATE_BASED_IN')
    organizations = RelationshipFrom(
        'organizations.models.ORGANIZATION', 'STATE_BASED_IN')
    activities = RelationshipFrom(
        'activities.models.ACTIVITY', 'STATE_BASED_IN')

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'states'


class SUBSTITUTION(DjangoNode):
    pk = UniqueIdProperty()
    minute = IntegerProperty(default=0)
    went_in_user = RelationshipTo('users.models.USER', 'WENT_IN')
    went_out_user = RelationshipTo('users.models.USER', 'WENT_OUT')
    competition = RelationshipFrom('competitions.models.COMPETITION', 'HAS')
    team = RelationshipFrom('teams.models.TEAM', 'MADE')

    def __str__(self):
        return self.date

    class Meta:
        app_label = 'substitutions'


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

    def __str__(self):
        return self.name

    class Meta:
        app_label = 'teams'


class USER(DjangoNode):
    username = StringProperty(
        required=True, unique_index=True, primary_key=True)
    password = StringProperty()
    is_active = BooleanProperty(default=True)
    first_name = StringProperty(required=True)
    last_name = StringProperty(required=True)
    date = DateProperty(required=True)
    created_at = DateTimeProperty(default_now=True)
    email = EmailProperty()
    gender = StringProperty(required=True)
    followers = RelationshipFrom('users.models.USER', 'FOLLOWS')
    following = RelationshipTo('users.models.USER', 'FOLLOWS')
    hobbies = RelationshipTo('categories.models.CATEGORY', 'LIKES')
    is_from = RelationshipTo('countries.models.COUNTRY', 'IS_FROM')
    based_in = RelationshipTo('locations.models.LOCATION', 'BASED_IN')
    belongs_to_this_organization = RelationshipTo(
        'organizations.models.ORGANIZATION', 'BELONGS_TO', model=Since)
    roles = RelationshipTo('roles.models.ROLE', 'IS')
    teams_joined = RelationshipTo(
        'teams.models.TEAM', 'IS_MEMBER_OF', model=JoinedTeamRel)
    assist_history = RelationshipFrom(
        'score_infos.models.SCORE_INFO', 'ASSISTED_BY')
    score_history = RelationshipFrom(
        'score_infos.models.SCORE_INFO', 'SCORED_BY')
    mvp_history = RelationshipFrom('competitions.models.COMPETITION', 'MVP')
    created_organization = RelationshipTo(
        'organizations.models.ORGANIZATION', 'CREATES')
    leagues_participated = RelationshipTo(
        'leagues.models.LEAGUE', 'PARTICIPATES_IN')
    sent_requests = RelationshipTo('join_requests.models.REQUEST', 'SENT')
    received_requests = RelationshipFrom(
        'join_requests.models.REQUEST', 'SENT_TO')
    activities_joined = RelationshipTo('activities.models.ACTIVITY', 'JOINS')
    activities_created = RelationshipTo(
        'activities.models.ACTIVITY', 'CREATES')
    subbed_in = RelationshipFrom(
        'substitutions.models.SUBSTITUTION', 'WENT_IN')
    subbed_out = RelationshipFrom(
        'substitutions.models.SUBSTITUTION', 'WENT_OUT')
    has_statistics_in_category = RelationshipTo(
        'categories.models.CATEGORY', 'HAS_STATISTICS_IN', model=Users_Category_Statistics)
    achievements = RelationshipTo(
        'achievements.models.ACHIEVEMENT', 'ACHIEVED')
    part_of_competition = RelationshipTo(
        'competitions.models.COMPETITION', 'PART_OF_COMPETITION')
    image_url = StringProperty()

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
