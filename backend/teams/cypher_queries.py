from neomodel import db
from neomodel.contrib.spatial_properties import NeomodelPoint



GET_TEAM_DETAIL_INFORMATION = """
            MATCH (team:TEAM {name: $team_name})
            // Categories
            OPTIONAL MATCH (team)-[:IS_TYPE_OF]->(category)
            OPTIONAL MATCH (team)-[:TSHIRT_COLOR]->(tshirtColor)
            OPTIONAL MATCH (team)-[:SHORTS_COLOR]->(shortsColor)
            OPTIONAL MATCH (team)-[:SOCKS_COLOR]->(socksColor)
            OPTIONAL MATCH (team)-[:AWAY_TSHIRT_COLOR]->(awayTshirtColor)
            OPTIONAL MATCH (team)<-[:SPONSORS]-(sponsor)
            OPTIONAL MATCH (team)-[:BELONGS_TO]->(organization)
            OPTIONAL MATCH (team)<-[member_rel:IS_MEMBER_OF]-(members:USER)-[:IS]->(role:ROLE)
            OPTIONAL MATCH (team)-[:BASED_IN]->(location:LOCATION)-[:IS_IN]->(city:CITY)-[:IS_IN]->(state:STATE)-[:IS_IN]->(country:COUNTRY)
            WITH team, city, state, country,
                COLLECT(DISTINCT properties(category)) as categories,
                COLLECT(DISTINCT properties(tshirtColor)) as tshirt_colors,
                COLLECT(DISTINCT properties(shortsColor)) as shorts_colors,
                COLLECT(DISTINCT properties(socksColor)) as socks_colors,
                COLLECT(DISTINCT properties(awayTshirtColor)) as away_tshirt_colors,
                COLLECT(DISTINCT properties(sponsor)) as sponsors,
                COLLECT(DISTINCT properties(organization)) as organizations,
                COLLECT(DISTINCT properties(location)) as locations,
                COLLECT({
                    first_name: members.first_name,
                    last_name: members.last_name,
                    username: members.username,
                    gender: members.gender,
                    image_url: members.image_url,
                    role: role.name,
                    name_on_jersey: member_rel.name_on_jersey,
                    player_number: member_rel.player_number,
                    plays_for_division: member_rel.plays_for_division
                }) as team_members
            RETURN {
                name: team.name,
                men_team: team.men_team,
                founded_at: team.founded_at,
                image_url: team.image_url,
                categories: categories,
                tshirt_color: tshirt_colors,
                shorts_color: shorts_colors,
                socks_color: socks_colors,
                away_tshirt_color: away_tshirt_colors,
                sponsors: sponsors,
                belongs_to_organization: organizations,
                location: locations,
                city_name: city.name,
                state_name: state.name,
                country_name: country.name,
                public_team: team.public_team,
                members: team_members
            } as team
        """




def list_teams_by_country(countries: list):
    """Lists all the teams based in a country."""
    query = """
        MATCH (c:COUNTRY)<-[:COUNTRY_BASED_IN]-(teams:TEAM) WHERE c.name IN $names
        MATCH (teams)-[:TSHIRT_COLOR]->(tshirtColor:COLOR)
        MATCH (teams)-[:SOCKS_COLOR]->(socksColor:COLOR)
        MATCH (teams)-[:SHORTS_COLOR]->(shortsColor:COLOR)
        MATCH (teams)-[:AWAY_TSHIRT_COLOR]->(awayTshirtColor:COLOR)
        MATCH (teams)-[:IS_TYPE_OF]->(category:CATEGORY)
        MATCH (teams)-[:BASED_IN]->(location)-[:IS_IN]->(city)-[:IS_IN]->(state)-[:IS_IN]->(country)
        RETURN teams.name AS name, 
            teams.men_team AS men_team, 
            teams.founded_at AS founded_at, 
            teams.image_url AS image_url, 
            collect(properties(category)) AS categories, 
            collect(properties(tshirtColor)) AS tshirt_color, 
            collect(properties(shortsColor)) AS shorts_color, 
            collect(properties(socksColor)) AS socks_color, 
            collect(properties(awayTshirtColor)) AS away_tshirt_color, 
            collect(properties(location)) AS location,
            city.name AS city_name, 
            state.name AS state_name, 
            country.name AS country_name,
            teams.public_team AS public_team
    """
    params = {'names': countries}
    results, meta = db.cypher_query(query, params, resolve_objects=True)
    results_dicts = [{
        'name': result[0],
        'men_team': result[1],
        # Convert it to python datetime because serializer datetime field does not accept neotime
        'founded_at': result[2].format(),
        'image_url': result[3],
        'categories': result[4][0],
        'tshirt_color': result[5][0],
        'shorts_color': result[6][0],
        'socks_color': result[7][0],
        'away_tshirt_color': result[8][0],
        'location': result[9][0],
        'city_name': result[10],
        'state_name': result[11],
        'country_name': result[12],
        'public_team': result[13],
    } for result in results
    ]
    return results_dicts


def list_teams_by_state(countries: list, states: list):
    """Lists all the teams based in a state."""
    query = """
            MATCH (c:COUNTRY) WHERE c.name IN $countries
            MATCH (c)<-[:IS_IN]-(s:STATE)<-[:STATE_BASED_IN]-(teams:TEAM) WHERE s.name IN $names
            MATCH (teams)-[:TSHIRT_COLOR]->(tshirtColor:COLOR)
            MATCH (teams)-[:SOCKS_COLOR]->(socksColor:COLOR)
            MATCH (teams)-[:SHORTS_COLOR]->(shortsColor:COLOR)
            MATCH (teams)-[:AWAY_TSHIRT_COLOR]->(awayTshirtColor:COLOR)
            MATCH (teams)-[:IS_TYPE_OF]->(category:CATEGORY)
            MATCH (teams)-[:BASED_IN]->(location)-[:IS_IN]->(city)-[:IS_IN]->(state)-[:IS_IN]->(country)
            WITH teams, city, state, country,
                collect(properties(category)) as categories,
                collect(properties(tshirtColor)) as tshirt_colors,
                collect(properties(shortsColor)) as shorts_colors,
                collect(properties(socksColor)) as socks_colors,
                collect(properties(awayTshirtColor)) as away_tshirt_colors,
                collect(properties(location)) as locations
            RETURN {
                name: teams.name,
                men_team: teams.men_team,
                founded_at: teams.founded_at,
                image_url: teams.image_url,
                categories: categories,
                tshirt_color: tshirt_colors,
                shorts_color: shorts_colors,
                socks_color: socks_colors,
                away_tshirt_color: away_tshirt_colors,
                location: locations,
                city_name: city.name,
                state_name: state.name,
                country_name: country.name,
                public_team: teams.public_team
            }
        """
    params = {'names': states, 'countries': countries}
    results, meta = db.cypher_query(query, params, resolve_objects=True)
    
    return results


def list_teams_by_city(countries: list, states: list, cities: list):
    """Lists all the teams based in a city."""
    query = """
        MATCH (c:COUNTRY) WHERE c.name IN $country_names
        MATCH (c)<-[:IS_IN] - (s:STATE) WHERE s.name IN $state_names
        MATCH (s)<-[:IS_IN] - (ci:CITY) WHERE ci.name IN $city_names
        WITH ci
        MATCH(ci)<-[:CITY_BASED_IN]-(teams:TEAM)
        WITH teams
        MATCH (teams)-[:TSHIRT_COLOR]->(tshirtColor:COLOR)
        MATCH (teams)-[:SOCKS_COLOR]->(socksColor:COLOR)
        MATCH (teams)-[:SHORTS_COLOR]->(shortsColor:COLOR)
        MATCH (teams)-[:AWAY_TSHIRT_COLOR]->(awayTshirtColor:COLOR)
        MATCH (teams)-[:IS_TYPE_OF]->(category:CATEGORY)
        MATCH (teams)-[:BASED_IN]->(location)-[:IS_IN]->(city)-[:IS_IN]->(state)-[:IS_IN]->(country)
        RETURN teams.name AS name, 
            teams.men_team AS men_team, 
            teams.founded_at AS founded_at, 
            teams.image_url AS image_url, 
            collect(properties(category)) AS categories, 
            collect(properties(tshirtColor)) AS tshirt_color, 
            collect(properties(shortsColor)) AS shorts_color, 
            collect(properties(socksColor)) AS socks_color, 
            collect(properties(awayTshirtColor)) AS away_tshirt_color, 
            collect(properties(location)) AS location,
            city.name AS city_name, 
            state.name AS state_name, 
            country.name AS country_name,
            teams.public_team AS public_team"""
    params = {'city_names': cities,
              'state_names': states, 'country_names': countries}
    results, meta = db.cypher_query(query, params, resolve_objects=True)
    print(results)
    results_dicts = [{
        'name': result[0],
        'men_team': result[1],
        # Convert it to python datetime because serializer datetime field does not accept neotime
        'founded_at': result[2].isoformat(),
        'image_url': result[3],
        'categories': result[4][0],
        'tshirt_color': result[5][0],
        'shorts_color': result[6][0],
        'socks_color': result[7][0],
        'away_tshirt_color': result[8][0],
        'location': result[9][0],
        'city_name': result[10],
        'state_name': result[11],
        'country_name': result[12],
        'public_team': result[13],
    } for result in results
    ]
    return results_dicts


def list_teams_by_name(name: str):
    """Lists all the teams based in a city."""
    query = """
        MATCH (teams:TEAM) WHERE teams.name CONTAINS $name
        MATCH (teams)-[:TSHIRT_COLOR]->(tshirtColor:COLOR)
        MATCH (teams)-[:SOCKS_COLOR]->(socksColor:COLOR)
        MATCH (teams)-[:SHORTS_COLOR]->(shortsColor:COLOR)
        MATCH (teams)-[:AWAY_TSHIRT_COLOR]->(awayTshirtColor:COLOR)
        MATCH (teams)-[:IS_TYPE_OF]->(category:CATEGORY)
        MATCH (teams)-[:BASED_IN]->(location)-[:IS_IN]->(city)-[:IS_IN]->(state)-[:IS_IN]->(country)
        RETURN teams.name AS name, 
            teams.men_team AS men_team, 
            teams.founded_at AS founded_at, 
            teams.image_url AS image_url, 
            collect(properties(category)) AS categories, 
            collect(properties(tshirtColor)) AS tshirt_color, 
            collect(properties(shortsColor)) AS shorts_color, 
            collect(properties(socksColor)) AS socks_color, 
            collect(properties(awayTshirtColor)) AS away_tshirt_color, 
            collect(properties(location)) AS location,
            city.name AS city_name, 
            state.name AS state_name, 
            country.name AS country_name,
            teams.public_team AS public_team"""
    params = {'name': name}
    results, meta = db.cypher_query(query, params, resolve_objects=True)
    results_dicts = [{
        'name': result[0],
        'men_team': result[1],
        # Convert it to python datetime because serializer datetime field does not accept neotime
        'founded_at': result[2].format(),
        'image_url': result[3],
        'categories': result[4][0],
        'tshirt_color': result[5][0],
        'shorts_color': result[6][0],
        'socks_color': result[7][0],
        'away_tshirt_color': result[8][0],
        'location': result[9][0],
        'city_name': result[10],
        'state_name': result[11],
        'country_name': result[12],
        'public_team': result[13],
    } for result in results
    ]
    return results_dicts
