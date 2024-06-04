from rest_framework import serializers
from users.serializers import UserSerializer
from teams.serializers import TeamCustomSerializer
from substitutions.serializers import SubstitutionSerializer


class CompetitionSerializer(serializers.Serializer):
    pk = serializers.CharField(read_only=True, required=False)
    first_half_extra_time = serializers.IntegerField(required=False)
    second_half_extra_time = serializers.IntegerField(required=False)
    won_by = TeamCustomSerializer(many=False, required=False)
    team_1 = TeamCustomSerializer(many=False, required=False)
    team_2 = TeamCustomSerializer(many=False, required=False)
    mvp_player = UserSerializer(many=False, required=False)
    league_name = serializers.CharField(required=False)
    league_pk = serializers.CharField(required=False)
    substituitions = SubstitutionSerializer(many=True, required=False)
