from rest_framework import serializers
from users.serializers import UserSerializer
from categories.serializers import CategorySerializer
from teams.serializers import TeamListSerializer
# from activities.serializers import ActivitySerializer


class RolesSerializer(serializers.Serializer):
    pk = serializers.CharField(read_only=True)
    name = serializers.CharField(required=True)
    users = UserSerializer(many=True)
    specialized_in = CategorySerializer(many=True, required=False)
    in_team = TeamListSerializer(many=True, required=False)
    # for_activity = ActivitySerializer(many=True, required=False)
