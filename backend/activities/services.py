from neomodel import db
from users.serializers import UserCustomSerializer
from categories.serializers import CategorySerializer
from competitions.serializers import CompetitionSerializer
from countries.serializers import CountrySerializer
from states.serializers import StateSerializer
from .cypher_queries import CREATE_ACTIVITY,LIST_ACTIVITIES_BY_CITY,LIST_ACTIVITIES_BY_COUNTRY,LIST_ACTIVITIES_BY_NAME,LIST_ACTIVITIES_BY_STATE, GET_ACTIVITY_DETAILS

class ActivityService:

    def create_activity(self,validated_data):
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
            results, meta = db.cypher_query(CREATE_ACTIVITY, params)
            activity = results[0][0]
            print(activity)
            return activity
        except Exception as e:
            print(e)
            return None


    def list_activities_by_country(self,countries):
        # Removed inline query; using imported LIST_ACTIVITIES_BY_COUNTRY instead
        params = {
            'countries': countries,
        }
        results, meta = db.cypher_query(LIST_ACTIVITIES_BY_COUNTRY, params)
        # Flatten the list by extracting elements from the inner list
        flat_activities = [item for sublist in results for item in sublist]
        return flat_activities


    def list_activities_by_state(self,countries, states):
        # Removed inline query; using imported LIST_ACTIVITIES_BY_STATE instead
        params = {
            'countries': countries,
            'states': states,
        }
        results, meta = db.cypher_query(LIST_ACTIVITIES_BY_STATE, params)
        flat_activities = [item for sublist in results for item in sublist]
        return flat_activities


    def list_activities_by_city(self,countries, states, cities):
        # Removed inline query; using imported LIST_ACTIVITIES_BY_CITY instead
        params = {
            'countries': countries,
            'states': states,
            'cities': cities
        }
        results, meta = db.cypher_query(LIST_ACTIVITIES_BY_CITY, params)
        flat_activities = [item for sublist in results for item in sublist]
        return flat_activities


    def list_activities_by_name(self,search_name):
        # Removed inline query; using imported LIST_ACTIVITIES_BY_NAME instead
        params = {
            'search_name': search_name
        }
        results, meta = db.cypher_query(LIST_ACTIVITIES_BY_NAME, params)
        activities = [activity for activity, in results]
        return activities


    def get_activity_details(self, activity_id):
        # Removed inline query; using imported GET_ACTIVITY_DETAILS instead
        params = {
            'activity_id': activity_id,
        }
        results, meta = db.cypher_query(GET_ACTIVITY_DETAILS, params)
        activity_details = [item for sublist in results for item in sublist]
        return activity_details
