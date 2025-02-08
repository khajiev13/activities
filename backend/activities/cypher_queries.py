
CREATE_ACTIVITY = """
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

LIST_ACTIVITIES_BY_COUNTRY = """
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

LIST_ACTIVITIES_BY_STATE = """
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

LIST_ACTIVITIES_BY_CITY = """
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
LIST_ACTIVITIES_BY_NAME = """
    MATCH (activity:ACTIVITY)
    WHERE activity.title CONTAINS $search_name
    RETURN activity
"""

GET_ACTIVITY_DETAILS = """
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
