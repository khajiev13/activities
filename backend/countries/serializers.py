from rest_framework import serializers
from states.serializers import StateSerializer
from countries.models import COUNTRY


class CountrySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    # number_of_activities = serializers.SerializerMethodField()
    # number_of_teams = serializers.SerializerMethodField()
    # number_of_users = serializers.SerializerMethodField()
    # number_of_organizations = serializers.SerializerMethodField()
    # def get_number_of_activities(self, obj):
    #     return len(obj.activities.all())
    # def get_number_of_teams(self, obj):
    #     return len(obj.teams.all())
    # def get_number_of_users(self, obj):
    #     return len(obj.users.all())
    # def get_number_of_organizations(self, obj):
    #     return len(obj.organizations.all())
    states = StateSerializer(many=True, required=False)

    def to_representation(self, instance):
        country_data = instance["country"]
        states_data = instance["states"] or []  # Handle empty states
        cities_data = instance["cities"] or []  # Handle empty cities

        # Build states map
        states_map = {}
        for state in states_data:
            if state:  # Check if state exists
                states_map[state.id] = {
                    "name": state["name"],
                    "cities": []
                }

        # Add cities to their states
        for city in cities_data:
            if city and hasattr(city, '__relationship__'):
                state_id = city.__relationship__.start_node_id
                if state_id in states_map:
                    states_map["cities"].append({
                        "name": city["name"]
                    })

        return {
            "name": country_data["name"],
            "states": list(states_map.values()),
        }