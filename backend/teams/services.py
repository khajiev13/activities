from neomodel import db
from .cypher_queries import GET_TEAM_DETAIL_INFORMATION



class TeamService:
    

    @staticmethod
    def get_team_detail_information(team_name: str) -> dict:
        """
        Retrieves detailed information about a team.
        Args:
            team_name (str): The name of the team.
        Returns:
            Dictionary: A dictionary containing the results  of the query.
        """
        
        params = {
            'team_name': team_name
        }
        results, meta = db.cypher_query(GET_TEAM_DETAIL_INFORMATION, params)   #     (results_dict['location'][0]['points'].latitude, results_dict['location'][0]['points'].longitude), crs='wgs-84')
        return results[0][0] #We should access [0][0] because that's how neo4j returns data

    @staticmethod
    def join_leave_team_toggle(self, user):
        if self.members.is_connected(user):
            # If the user is already a member, disconnect them
            self.members.disconnect(user)
            return False  # Indicates the user has left the team
        else:
            # If the user is not a member, connect them
            self.members.connect(user)
            return True  # Indicates the user has joined the team
        
    @staticmethod
    def create_and_connect_nodes_for_team(team) -> bool:
        """"params should be a dictionary with the following keys:
        name, belongs_to_organization, categories, sponsors, country, state, city, pk_for_location, uniform_colors
        \n Then it will connect the team with the organization, categories, sponsors, location, and uniform colors.
        """
        teamname = team.name
        categories_data = [category['pk'] for category in team.categories]
        country_name = team.country_name
        state_name = team.state_name
        city_name = team.city_name
        tshirt_color = team.tshirt_color[0]['name'] if team.tshirt_color else None
        shorts_color = team.shorts_color[0]['name'] if team.shorts_color else None
        socks_color = team.socks_color[0]['name'] if team.socks_color else None
        away_tshirt_color = team.away_tshirt_color[0]['name'] if team.away_tshirt_color else None
        belongs_to_organization_pk = [org['pk']
                                    for org in team.belongs_to_organization][0]
        sponsors_pks = [sponsor['pk'] for sponsor in team.sponsors]
        pk_for_location = [location['pk'] for location in team.location][0]
        founded_at = team.founded_at
        men_team = team.men_team
        image_url = team.image_url
        public_team = team.public_team

        query = """
                MERGE (team:TEAM {name: $teamname, founded_at: $founded_at, image_url: $image_url, men_team: $men_team, public_team: $public_team})
                MERGE (tshirt_color:COLOR {name: $tshirt_color})
                MERGE (shorts_color:COLOR {name: $shorts_color})
                MERGE (socks_color:COLOR {name: $socks_color})
                MERGE (awaytshirt_color:COLOR {name: $awaytshirt_color})
                MERGE (team)-[:TSHIRT_COLOR]->(tshirt_color)
                MERGE (team)-[:SHORTS_COLOR]->(shorts_color)
                MERGE (team)-[:SOCKS_COLOR]->(socks_color)
                MERGE (team)-[:AWAY_TSHIRT_COLOR]->(awaytshirt_color)
                WITH team
                MERGE (country:COUNTRY {name: $country_name})
                MERGE (state:STATE {name: $state_name})-[:IS_IN]->(country)
                MERGE (city:CITY {name: $city_name})-[:IS_IN]->(state)
                MERGE (location:LOCATION {pk: $pk_for_location})-[:IS_IN]->(city)
                WITH team, country, state, city, location
                MERGE (team)-[:BASED_IN]->(location)
                MERGE (team)-[:CITY_BASED_IN]->(city)
                MERGE (team)-[:STATE_BASED_IN]->(state)
                MERGE (team)-[:COUNTRY_BASED_IN]->(country)
                WITH team
                OPTIONAL MATCH (organization:ORGANIZATION {pk: $belongs_to_organization_pk})
                FOREACH (categoryPk IN $categories_data | 
                    MERGE (category:CATEGORY {pk: categoryPk})
                    MERGE (team)-[:IS_TYPE_OF]->(category))
                FOREACH (sponsorPk IN CASE WHEN $sponsors_pks IS NOT NULL AND size($sponsors_pks) > 0 THEN $sponsors_pks ELSE [] END | 
                    MERGE (sponsor:ORGANIZATION {pk: sponsorPk})
                    MERGE (sponsor)-[:SPONSORS {since: datetime()}]->(team))
                FOREACH (org IN CASE WHEN organization IS NOT NULL THEN [1] ELSE [] END | 
                    MERGE (team)-[:BELONGS_TO]->(organization))          
                RETURN team
            """
        params = {
            'teamname': teamname,
            'belongs_to_organization_pk': belongs_to_organization_pk,
            'categories_data': categories_data,
            'sponsors_pks': sponsors_pks,
            'country_name': country_name,
            'state_name': state_name,
            'city_name': city_name,
            'pk_for_location': pk_for_location,
            'tshirt_color': tshirt_color,
            'shorts_color': shorts_color,
            'socks_color': socks_color,
            'awaytshirt_color': away_tshirt_color,
            'founded_at': founded_at,
            'image_url': image_url,
            'men_team': men_team,
            'public_team': public_team

        }
        try:
            results, meta = db.cypher_query(query, params)
            return 1
        except Exception as e:
            return 0
