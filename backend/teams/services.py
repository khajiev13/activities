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

