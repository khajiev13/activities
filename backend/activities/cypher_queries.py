from neomodel import db
from users.serializers import UserCustomSerializer
from categories.serializers import CategorySerializer
from competitions.serializers import CompetitionSerializer
from countries.serializers import CountrySerializer
from states.serializers import StateSerializer


def create_activity(validated_data):
    query = """
        MERGE (activity:ACTIVITY {
            pk: apoc.create.uuid(),
            title: $title,
            description: $description,
            duration_in_minutes: $duration_in_minutes,
            public: $public,
            date_time: $date_time
        })
        WITH activity
        MATCH (creator:USER {username: $creator_username})
        CREATE (creator)-[:CREATES]->(activity)
        WITH activity
        MATCH (location:LOCATION {pk: $location})
        CREATE (activity)-[:HAPPENS_AT]->(location)
        FOREACH (categoryPk IN $categories | 
            MERGE (category:CATEGORY {pk: categoryPk})
            CREATE (activity)-[:IS_TYPE_OF]->(category))
        FOREACH (ignoreMe IN CASE WHEN $is_competition THEN [1] ELSE [] END |
            MERGE (competition:COMPETITION {pk: apoc.create.uuid()})
            MERGE (activity)-[:IS_COMPETITION]->(competition)
            MERGE (team1:TEAM {name: $team1})
            MERGE (team2:TEAM {name: $team2})
            MERGE (competition)-[:TEAM_1]->(team1)
            MERGE (competition)-[:TEAM_2]->(team2))
        MERGE (country:COUNTRY {name: $country})
        MERGE (state:STATE {name: $state})
        MERGE (city:CITY {name: $city})
        MERGE (activity)-[:COUNTRY_BASED_IN]->(country)
        MERGE (activity)-[:STATE_BASED_IN]->(state)
        MERGE (activity)-[:CITY_BASED_IN]->(city)
        RETURN activity
    """
    params = {
        'title': validated_data['title'],
        'description': validated_data['description'],
        'duration_in_minutes': validated_data['duration_in_minutes'],
        'public': validated_data['public'],
        'date_time': validated_data['date_time'],
        'creator_username': validated_data['creator']['username'],
        'location': validated_data['location']['pk'],
        'categories': [category['pk'] for category in validated_data['categories']],
        'is_competition': validated_data['is_competition'],
        'team1': validated_data['competition']['team_1']['name'] if validated_data['is_competition'] else None,
        'team2': validated_data['competition']['team_2']['name'] if validated_data['is_competition'] else None,
        'country': validated_data['country']['name'],
        'state': validated_data['state']['name'],
        'city': validated_data['city']['name']
    }
    print(params)
    try:
        results, meta = db.cypher_query(query, params)
        activity = results[0][0]
        print(activity)
        return activity
    except Exception as e:
        print(e)
        return None


def list_activities_by_country(countries):
    query = """
        MATCH (country:COUNTRY)
        WHERE country.name IN $countries
        MATCH (activity:ACTIVITY)-[:COUNTRY_BASED_IN]->(country)
        MATCH (activity)-[:IS_TYPE_OF]->(category:CATEGORY)
        MATCH (activity)<-[cr:CREATES]-(creator:USER)
        OPTIONAL MATCH (activity)-[:IS_COMPETITION]->(competition:COMPETITION)
        OPTIONAL MATCH (competition)-[:TEAM_1]->(team1:TEAM)
        OPTIONAL MATCH (competition)-[:TEAM_2]->(team2:TEAM)
        OPTIONAL MATCH (user:USER)-[:JOINS]->(activity)
        MATCH (country)<-[:IS_IN]-(state:STATE)<-[:IS_IN]-(city:CITY)
        MATCH (activity)-[:HAPPENS_AT]->(location:LOCATION)
        MATCH (location)-[:IS_IN]->(city)-[:IS_IN]->(state)-[:IS_IN]->(country)
        // Aggregate data separately
        WITH activity, country, state, city, creator, competition, team1, team2,location,
            COUNT(user) AS number_of_people_joined,
            COLLECT(DISTINCT {
            first_name: user.first_name, 
            last_name: user.last_name, 
            image_url: user.image_url,
            username: user.username
            }) AS people_joined,
            COLLECT(DISTINCT { pk: category.pk, name: category.name }) AS categories

        RETURN {
            title: activity.title,
            description: activity.description,
            public: activity.public,
            date_time: activity.date_time,
            duration_in_minutes: activity.duration_in_minutes,
            pk: activity.pk,
            country:{ name:country.name},
            state:{ name:state.name},
            city: { name:city.name},
            categories: categories,
            creator: { 
                first_name: creator.first_name, 
                last_name: creator.last_name, 
                image_url: creator.image_url, 
                username: creator.username
            },
            competition: {
                team_1: { name: team1.name, image_url: team1.image_url },
                team_2: { name: team2.name, image_url: team2.image_url }
            },
            location: {
                name: location.name,
                pk: location.pk,
                points: location.points
            },
            number_of_people_joined: number_of_people_joined,
            people_joined: people_joined
        }

    """
    params = {
        'countries': countries,
    }
    results, meta = db.cypher_query(query, params)
    # Flatten the list by extracting elements from the inner list
    flat_activities = [item for sublist in results for item in sublist]

    return flat_activities


def list_activities_by_state(countries, states):
    query = """
        MATCH (country:COUNTRY)<-[:IS_IN]-(state:STATE)
        WHERE country.name IN $countries AND state.name IN $states
        MATCH (activity:ACTIVITY)-[:STATE_BASED_IN]->(state)
        MATCH (activity)-[:IS_TYPE_OF]->(category:CATEGORY)
        MATCH (activity)<-[cr:CREATES]-(creator:USER)
        OPTIONAL MATCH (activity)-[:IS_COMPETITION]->(competition:COMPETITION)
        OPTIONAL MATCH (competition)-[:TEAM_1]->(team1:TEAM)
        OPTIONAL MATCH (competition)-[:TEAM_2]->(team2:TEAM)
        OPTIONAL MATCH (user:USER)-[:JOINS]->(activity)
        MATCH (country)<-[:IS_IN]-(state:STATE)<-[:IS_IN]-(city:CITY)
        MATCH (activity)-[:HAPPENS_AT]->(location:LOCATION)
        MATCH (location)-[:IS_IN]->(city)-[:IS_IN]->(state)-[:IS_IN]->(country)
        // Aggregate data separately
        WITH activity, country, state, city, creator, competition, team1, team2,location,
            COUNT(user) AS number_of_people_joined,
            COLLECT(DISTINCT {
                first_name: user.first_name, 
                last_name: user.last_name, 
                image_url: user.image_url,
                username: creator.username
            }) AS people_joined,
            COLLECT(DISTINCT { pk: category.pk, name: category.name }) AS categories

        RETURN {
            title: activity.title,
            description: activity.description,
            public: activity.public,
            date_time: activity.date_time,
            duration_in_minutes: activity.duration_in_minutes,
            pk: activity.pk,
            country:{ name:country.name},
            state:{ name:state.name},
            city: { name:city.name},
            categories: categories,
            creator: { 
                first_name: creator.first_name, 
                last_name: creator.last_name, 
                image_url: creator.image_url, 
                username: creator.username
            },
            competition: {
                team_1: { name: team1.name, image_url: team1.image_url },
                team_2: { name: team2.name, image_url: team2.image_url }
            },
            location: {
                name: location.name,
                pk: location.pk,
                points: location.points
            },
            number_of_people_joined: number_of_people_joined,
            people_joined: people_joined
        }        
    """
    params = {
        'countries': countries,
        'states': states,
    }
    results, meta = db.cypher_query(query, params)
    # Flatten the list by extracting elements from the inner list
    flat_activities = [item for sublist in results for item in sublist]

    return flat_activities


def list_activities_by_city(countries, states, cities):
    query = """
        MATCH (country:COUNTRY)<-[:IS_IN]-(state:STATE)<-[:IS_IN]-(city:CITY)
        WHERE country.name IN $countries AND state.name IN $states AND city.name IN $cities
        MATCH (activity:ACTIVITY)-[:CITY_BASED_IN]->(city)
        MATCH (activity)-[:IS_TYPE_OF]->(category:CATEGORY)
        MATCH (activity)<-[cr:CREATES]-(creator:USER)
        OPTIONAL MATCH (activity)-[:IS_COMPETITION]->(competition:COMPETITION)
        OPTIONAL MATCH (competition)-[:TEAM_1]->(team1:TEAM)
        OPTIONAL MATCH (competition)-[:TEAM_2]->(team2:TEAM)
        OPTIONAL MATCH (user:USER)-[:JOINS]->(activity)
        MATCH (country)<-[:IS_IN]-(state:STATE)<-[:IS_IN]-(city:CITY)
        MATCH (activity)-[:HAPPENS_AT]->(location:LOCATION)
        MATCH (location)-[:IS_IN]->(city)-[:IS_IN]->(state)-[:IS_IN]->(country)
        // Aggregate data separately
        WITH activity, country, state, city, creator, competition, team1, team2,location,
            COUNT(user) AS number_of_people_joined,
            COLLECT(DISTINCT {
                first_name: user.first_name, 
                last_name: user.last_name, 
                image_url: user.image_url,
                username: creator.username
            }) AS people_joined,
            COLLECT(DISTINCT { pk: category.pk, name: category.name }) AS categories

        RETURN {
            title: activity.title,
            description: activity.description,
            public: activity.public,
            date_time: activity.date_time,
            duration_in_minutes: activity.duration_in_minutes,
            pk: activity.pk,
            country:{ name:country.name},
            state:{ name:state.name},
            city: { name:city.name},
            categories: categories,
            creator: { 
                first_name: creator.first_name, 
                last_name: creator.last_name, 
                image_url: creator.image_url, 
                username: creator.username
            },
            competition: {
                team_1: { name: team1.name, image_url: team1.image_url },
                team_2: { name: team2.name, image_url: team2.image_url }
            },
            location: {
                name: location.name,
                pk: location.pk,
                points: location.points
            },
            number_of_people_joined: number_of_people_joined,
            people_joined: people_joined
        }        

    """
    params = {
        'countries': countries,
        'states': states,
        'cities': cities
    }
    results, meta = db.cypher_query(query, params)
    # Flatten the list by extracting elements from the inner list
    flat_activities = [item for sublist in results for item in sublist]

    return flat_activities


def list_activities_by_name(search_name):
    query = """
        MATCH (activity:ACTIVITY)
        WHERE activity.title CONTAINS $search_name
        RETURN activity
    """
    params = {
        'search_name': search_name
    }
    results, meta = db.cypher_query(query, params)
    activities = [activity for activity, in results]
    return activities


def get_activity_details(activity_id):
    query = """
        MATCH (activity:ACTIVITY)
        WHERE ID(activity) = $activity_id
        MATCH (activity)-[:IS_TYPE_OF]->(category:CATEGORY)
        MATCH (activity)<-[cr:CREATES]-(creator:USER)
        OPTIONAL MATCH (activity)-[:IS_COMPETITION]->(competition:COMPETITION)
        OPTIONAL MATCH (competition)-[:TEAM_1]->(team1:TEAM)
        OPTIONAL MATCH (competition)-[:TEAM_2]->(team2:TEAM)
        OPTIONAL MATCH (user:USER)-[:JOINS]->(activity)
        MATCH (country)<-[:IS_IN]-(state:STATE)<-[:IS_IN]-(city:CITY)
        MATCH (activity)-[:HAPPENS_AT]->(location:LOCATION)
        MATCH (location)-[:IS_IN]->(city)-[:IS_IN]->(state)-[:IS_IN]->(country)
        // Aggregate data separately
        WITH activity, country, state, city, creator, competition, team1, team2, location,
            COUNT(user) AS number_of_people_joined,
            COLLECT(DISTINCT {
                first_name: user.first_name, 
                last_name: user.last_name, 
                image_url: user.image_url,
                username: creator.username
            }) AS people_joined,
            COLLECT(DISTINCT { pk: category.pk, name: category.name }) AS categories

        RETURN {
            title: activity.title,
            description: activity.description,
            public: activity.public,
            date_time: activity.date_time,
            duration_in_minutes: activity.duration_in_minutes,
            pk: activity.pk,
            country:{ name:country.name},
            state:{ name:state.name},
            city: { name:city.name},
            categories: categories,
            creator: { 
                first_name: creator.first_name, 
                last_name: creator.last_name, 
                image_url: creator.image_url, 
                username: creator.username
            },
            competition: {
                team_1: { name: team1.name, image_url: team1.image_url },
                team_2: { name: team2.name, image_url: team2.image_url }
            },
            location: {
                name: location.name,
                pk: location.pk,
                points: location.points
            },
            number_of_people_joined: number_of_people_joined,
            people_joined: people_joined
        }
    """
    params = {
        'activity_id': activity_id,
    }
    results, meta = db.cypher_query(query, params)
    activity_details = [item for sublist in results for item in sublist]
    return activity_details
