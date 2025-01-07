from neomodel import (StringProperty,RelationshipFrom,One, ZeroOrOne)
from django_neomodel import DjangoNode
from neomodel import db
class COUNTRY(DjangoNode):
    name = StringProperty(required=True, unique_index=True)
    states = RelationshipFrom('states.models.STATE', 'IS_IN') 
    users = RelationshipFrom('users.models.USER', 'IS_FROM')
    teams = RelationshipFrom('teams.models.TEAM', 'COUNTRY_BASED_IN')
    activities = RelationshipFrom('activities.models.ACTIVITY', 'BASED_IN')
    organizations = RelationshipFrom('organizations.models.ORGANIZATION', 'COUNTRY_BASED_IN',)
    def __str__(self):
            return self.name
    
    @staticmethod
    def get_all_countries_with_states_and_cities():
        query = """
            MATCH (country:COUNTRY)
            OPTIONAL MATCH (country)<-[:IS_IN]-(state:STATE)
            OPTIONAL MATCH (state)<-[:IS_IN]-(city:CITY)
            RETURN country, collect(DISTINCT state) AS states, collect(DISTINCT city) AS cities
        """
        results, meta = db.cypher_query(query)
        return results
    class Meta:
        app_label = 'countries'