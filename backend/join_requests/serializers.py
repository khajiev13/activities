from rest_framework import serializers
# from activities.serializers import ActivitySerializer
from users.serializers import UserSerializer
from organizations.serializers import OrganizationSerializer
from teams.serializers import TeamListSerializer


class JoinRequestsSerializer(serializers.Serializer):
    pk = serializers.CharField(read_only=True)
    accepted = serializers.BooleanField(default=False)
    pending = serializers.BooleanField(default=True)
    time = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S")
    sender_message = serializers.CharField(required=False)
    welcomed_rejected_message = serializers.CharField(required=False)
    # to_join_activity = ActivitySerializer(many=False, required=False)
    from_user = UserSerializer(many=False, required=False)
    to_user = UserSerializer(many=False, required=False)
    to_join_organization = OrganizationSerializer(many=False, required=False)
    to_join_team = TeamListSerializer(many=False, required=False)
    friendly_game_request_from = TeamListSerializer(
        many=False, required=False)
    friendly_game_request_to = TeamListSerializer(many=False, required=False)
