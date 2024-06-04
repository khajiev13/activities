from neomodel import db


def list_organizations_by_country(countries):
    query = """
        MATCH (country:COUNTRY)<-[:COUNTRY_BASED_IN]-(organization:ORGANIZATION)
        WHERE country.name IN $countries
        OPTIONAL MATCH (organization)-[:LOCATED_AT]->(location:LOCATION)
        OPTIONAL MATCH (organization)-[:HAS_TEAM]->(team:TEAM)
        OPTIONAL MATCH (organization)-[:HOSTS]->(league:LEAGUE)
        OPTIONAL MATCH (organization)-[:HOSTS]->(activity:ACTIVITY)
        OPTIONAL MATCH (organization)-[:SPONSORS]->(sponsors_teams:TEAM)
        WITH organization, country, 
             COLLECT(DISTINCT team) AS teams,
             COLLECT(DISTINCT league) AS leagues,
             COLLECT(DISTINCT activity) AS activities,
             COLLECT(DISTINCT sponsors_teams) AS sponsors_teams,
             location
        OPTIONAL MATCH (location)-[:IS_IN]->(city:CITY)-[:IS_IN]->(state:STATE)
        WITH organization, country, teams, leagues, activities, location, city, state, sponsors_teams,
             SIZE([(user:USER)-[:BELONGS_TO]->(org) WHERE org = organization | user]) AS number_of_people_joined
        RETURN {
            pk: organization.pk,
            name: organization.name,
            image_url: organization.image_url,
            created_at: organization.created_at,
            country: { name: country.name },
            state: { name: state.name },
            city: { name: city.name },
            location: {
                name: location.name,
                pk: location.pk,
                points: location.points
            },
            members_count: number_of_people_joined, 
            teams_count: SIZE(teams),
            hosting_leagues_count: SIZE(leagues),
            hosting_activities_count: SIZE(activities),
            sponsors_teams_count:SIZE(sponsors_teams)
        } AS organizationDetails
    """
    params = {
        'countries': countries,
    }
    results, meta = db.cypher_query(query, params)
    # Flatten the list by extracting elements from the inner list
    flat_organizations = [item for sublist in results for item in sublist]

    return flat_organizations
