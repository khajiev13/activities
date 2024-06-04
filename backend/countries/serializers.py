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

    def create(self, validated_data):
        country = COUNTRY.get_or_create(**validated_data)
        return country
