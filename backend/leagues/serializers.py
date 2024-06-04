from rest_framework import serializers
from organizations.serializers import OrganizationSerializer
from users.serializers import UserSerializer
from categories.serializers import CategorySerializer
from cities.serializers import CitySerializer
from states.serializers import StateSerializer
from competitions.serializers import CompetitionSerializer
from teams.serializers import TeamListSerializer


class LeagueSerializer(serializers.Serializer):
    pk = serializers.CharField(read_only=True)
    name = serializers.CharField(required=False)
    description = serializers.CharField(required=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    hosting_organizations = OrganizationSerializer(many=True, required=False)
    participating_users = UserSerializer(many=True, required=False)
    category = CategorySerializer(many=False, required=False)
    city = CitySerializer(many=False, required=False)
    state = StateSerializer(many=False, required=False)
    competitions = CompetitionSerializer(many=True, required=False)
    participating_teams = TeamListSerializer(many=True, required=False)
