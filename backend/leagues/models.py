from neomodel import (StringProperty, DateProperty, UniqueIdProperty,RelationshipTo,RelationshipFrom)
from django_neomodel import DjangoNode

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