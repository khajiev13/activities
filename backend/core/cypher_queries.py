from neomodel import db
from neomodel.contrib.spatial_properties import NeomodelPoint

def create_and_connect_nodes_for_team(team)->bool:
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


        print(teamname,belongs_to_organization_pk,categories_data,sponsors_pks,country_name,state_name,city_name,pk_for_location,tshirt_color,shorts_color,socks_color,away_tshirt_color)

        query = """
            MERGE (team:TEAM {name: $teamname, founded_at: $founded_at, image_url: $image_url, men_team: $men_team})
            MERGE (tshirt_color:COLOR {name: $tshirt_color})
            MERGE (shorts_color:COLOR {name: $shorts_color})
            MERGE (socks_color:COLOR {name: $socks_color})
            MERGE (awaytshirt_color:COLOR {name: $awaytshirt_color})
            MERGE (team)-[:TSHIRT_COLOR]->(tshirt_color)
            MERGE (team)-[:SHORTS_COLOR]->(shorts_color)
            MERGE (team)-[:SOCKS_COLOR]->(socks_color)
            MERGE (team)-[:AWAY_TSHIRT_COLOR]->(awaytshirt_color)
            WITH team
            MATCH (organization:ORGANIZATION {pk: $belongs_to_organization_pk})
            MERGE (country:COUNTRY {name: $country_name})
            MERGE (state:STATE {name: $state_name})-[:IS_IN]->(country)
            MERGE (city:CITY {name: $city_name})-[:IS_IN]->(state)
            MERGE (location:LOCATION {pk: $pk_for_location})-[:IS_IN]->(city)
            WITH team, organization, country, state, city, location
            FOREACH (categoryPk IN $categories_data | 
                MERGE (category:CATEGORY {pk: categoryPk})
                MERGE (team)-[:IS_TYPE_OF]->(category))
            FOREACH (sponsorPk IN $sponsors_pks | 
                MERGE (sponsor:ORGANIZATION {pk: sponsorPk})
                MERGE (sponsor)-[:SPONSORS {since: datetime()}]->(team))
            MERGE (team)-[:BELONGS_TO]->(organization)
            MERGE (team)-[:BASED_IN]->(location)
            MERGE (team)-[:CITY_BASED_IN]->(city)
            MERGE (team)-[:STATE_BASED_IN]->(state)
            MERGE (team)-[:COUNTRY_BASED_IN]->(country)
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
            'men_team':men_team,

        }
        try:
            results, meta = db.cypher_query(query, params)
            return 1
        except Exception as e:
             return 0



def get_team_detail_information(team_name:str)->dict:
    """
    Retrieves detailed information about a team.
    Args:
        team_name (str): The name of the team.
    Returns:
        Dictionary: A dictionary containing the results  of the query.
    """
    query = """
        MATCH (team:TEAM {name: $team_name})
        // Categories
        OPTIONAL MATCH (team)-[:IS_TYPE_OF]->(category)
        // Uniform Colors
        OPTIONAL MATCH (team)-[:TSHIRT_COLOR]->(tshirtColor)
        OPTIONAL MATCH (team)-[:SHORTS_COLOR]->(shortsColor)
        OPTIONAL MATCH (team)-[:SOCKS_COLOR]->(socksColor)
        OPTIONAL MATCH (team)-[:AWAY_TSHIRT_COLOR]->(awayTshirtColor)
        // Sponsors and Organization
        OPTIONAL MATCH (team)<-[:SPONSORS]-(sponsor)
        OPTIONAL MATCH (team)-[:BELONGS_TO]->(organization)
        // Location Details
        OPTIONAL MATCH (team)-[:BASED_IN]->(location)-[:IS_IN]->(city)-[:IS_IN]->(state)-[:IS_IN]->(country)
        RETURN team.name AS name, 
            team.men_team AS men_team, 
            team.founded_at AS founded_at, 
            team.image_url AS image_url, 
            collect(properties(category)) AS categories, 
            collect(properties(tshirtColor)) AS tshirt_color, 
            collect(properties(shortsColor)) AS shorts_color, 
            collect(properties(socksColor)) AS socks_color, 
            collect(properties(awayTshirtColor)) AS away_tshirt_color, 
            collect(properties(sponsor)) AS sponsors, 
            collect(properties(organization))AS belongs_to_organization ,
            collect(properties(location)) AS location,
            city.name AS city_name, 
            state.name AS state_name, 
            country.name AS country_name,
            team.public_team AS public_team
    """
    params = {
        'team_name': team_name
    }
    results, meta = db.cypher_query(query,params)
    results_dict = {
        'name': results[0][0],
        'men_team': results[0][1],
        'founded_at': results[0][2],
        'image_url': results[0][3],
        'categories': results[0][4],
        'tshirt_color': results[0][5],
        'shorts_color': results[0][6],
        'socks_color': results[0][7],
        'away_tshirt_color': results[0][8],
        'sponsors': results[0][9],
        'belongs_to_organization': results[0][10],
        'location': results[0][11],
        'city_name': results[0][12],
        'state_name': results[0][13],
        'country_name': results[0][14],
        'public_team': results[0][15]
    }
    results_dict['location'][0]['points'] =  NeomodelPoint((results_dict['location'][0]['points'].latitude, results_dict['location'][0]['points'].longitude), crs='wgs-84')
    print(results_dict['location'][0]['points'].latitude)
    return results_dict


