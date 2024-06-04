from rest_framework import serializers
from users.serializers import UserSerializer
from teams.serializers import TeamListSerializer


class SubstitutionSerializer(serializers.Serializer):
    pk = serializers.CharField(read_only=True)
    minute = serializers.IntegerField(required=False)
    went_in_user = UserSerializer(many=False, required=False)
    went_out_user = UserSerializer(many=False, required=False)
    team = TeamListSerializer(many=False, required=False)
