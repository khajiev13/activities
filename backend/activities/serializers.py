from rest_framework import serializers

from categories.serializers import CategorySerializer
from locations.serializers import LocationSerializer
from users.serializers import UserCustomSerializer
from locations.serializers import LocationSerializer
from achievements.serializers import AchievementsSerializer
from join_requests.serializers import JoinRequestsSerializer
from roles.serializers import RolesSerializer
from organizations.serializers import OrganizationSerializer
from teams.serializers import TeamCustomSerializer
from competitions.serializers import CompetitionSerializer
from countries.serializers import CountrySerializer
from states.serializers import StateSerializer
from cities.serializers import CitySerializer
from .cypher_queries import create_activity
import datetime


class TimestampField(serializers.Field):
    def to_representation(self, value):
        # Convert Unix timestamp to datetime object and format it as 'YYYY-MM-DDTHH:MM:SSZ'
        if isinstance(value, datetime.datetime):
            return value.isoformat()
        else:
            return datetime.datetime.fromtimestamp(value, tz=datetime.timezone.utc).isoformat()

    def to_internal_value(self, data):
        # Convert 'YYYY-MM-DDTHH:MM:SS.sssZ' formatted string back to Unix timestamp
        print(data)
        # Convert 'YYYY-MM-DDTHH:MM:SS.sssZ' formatted string back to Unix timestamp
        dt = datetime.datetime.strptime(
            data, '%Y-%m-%dT%H:%M:%S.%fZ').replace(tzinfo=datetime.timezone.utc)
        print(dt)
        print(int(dt.timestamp()))
        return int(dt.timestamp())


class ActivitySerializer(serializers.Serializer):
    pk = serializers.CharField(read_only=True)
    title = serializers.CharField(required=True)
    description = serializers.CharField(required=True)
    duration_in_minutes = serializers.IntegerField(required=True)
    public = serializers.BooleanField(default=True)
    date_time = TimestampField()
    location = LocationSerializer(many=False, required=False)
    people_joined = UserCustomSerializer(many=True, required=False)
    number_of_people_joined = serializers.IntegerField(required=False)
    categories = CategorySerializer(many=True)
    creator = UserCustomSerializer(many=False, required=False)
    is_competition = serializers.BooleanField(required=False)
    achievements_earned = AchievementsSerializer(many=True, required=False)
    requests_to_join = JoinRequestsSerializer(many=True, required=False)
    roles = RolesSerializer(many=True, required=False)
    organizer_organization = OrganizationSerializer(many=True, required=False)
    teams = TeamCustomSerializer(many=True, required=False)
    competition = CompetitionSerializer(required=False)
    country = CountrySerializer(many=False, required=False)
    state = StateSerializer(many=False, required=False)
    city = CitySerializer(many=False, required=False)

    def create(self, validated_data):
        print(validated_data)
        activity = create_activity(validated_data)
        return activity

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
