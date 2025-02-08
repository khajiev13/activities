from neomodel import db
from .cypher_queries import GET_TEAM_DETAIL_INFORMATION, LIST_TEAMS_BY_STATE, CREATE_AND_CONNECT_NODES_FOR_TEAM,LIST_TEAMS_BY_COUNTRY, LIST_TEAMS_BY_CITY, LIST_TEAMS_BY_NAME


class TeamService:
    
    def get_team_detail_information(self,team_name: str) -> dict:
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

    def join_leave_team_toggle(self, user):
        if self.members.is_connected(user):
            # If the user is already a member, disconnect them
            self.members.disconnect(user)
            return False  # Indicates the user has left the team
        else:
            # If the user is not a member, connect them
            self.members.connect(user)
            return True  # Indicates the user has joined the team
        

    def create_and_connect_nodes_for_team(self,team) -> bool:
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
        belongs_to_organization_pk = [org['pk'] for org in team.belongs_to_organization][0]
        sponsors_pks = [sponsor['pk'] for sponsor in team.sponsors]
        pk_for_location = [location['pk'] for location in team.location][0]
        founded_at = team.founded_at
        men_team = team.men_team
        image_url = team.image_url
        public_team = team.public_team

        
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
            results, meta = db.cypher_query(CREATE_AND_CONNECT_NODES_FOR_TEAM, params)
            return 1
        except Exception as e:
            return 0
        

    
    def list_teams_by_state(self,countries: list, states: list):
        """Lists all the teams based in a state."""
        
        params = {'names': states, 'countries': countries}
        results, meta = db.cypher_query(LIST_TEAMS_BY_STATE, params, resolve_objects=True)
        teams = [team[0] for team in results] #Gotta choose the first item in a list because it returns a list of values
        return teams
    
    def list_teams_by_country(self,countries: list):
        """Lists all the teams based in a country."""
        
        params = {'names': countries}
        results, meta = db.cypher_query(LIST_TEAMS_BY_COUNTRY, params, resolve_objects=True)
        teams = [team[0] for team in results]
        return teams


    def list_teams_by_city(self,countries: list, states: list, cities: list):
        """Lists all the teams based in a city."""
        
        params = {'city_names': cities,
                'state_names': states, 'country_names': countries}
        results, meta = db.cypher_query(LIST_TEAMS_BY_CITY, params, resolve_objects=True)
        teams = [team[0] for team in results]
        return teams


    def list_teams_by_name(self,name: str):
        """Lists all the teams based in a city."""
        
        params = {'name': name}
        results, meta = db.cypher_query(LIST_TEAMS_BY_NAME, params, resolve_objects=True)
        
        # Convert datetime for each result
        teams = []
        for result in results:
            team = result[0]  # Now each result is a single map
            if team['founded_at']:
                team['founded_at'] = team['founded_at'].format()
            teams.append(team)
        
        return teams
