from rest_framework import serializers
# from activities.serializers import ActivitySerializer
from categories.serializers import CategorySerializer
from users.serializers import UserSerializer


class AchievementsSerializer(serializers.Serializer):
    pk = serializers.CharField(read_only=True)
    name = serializers.CharField(required=True)
    description = serializers.CharField(required=True)
    picture_url = serializers.CharField(required=True)
    # during = ActivitySerializer(many=False, required=False)
    category = CategorySerializer(many=True, required=False)
    owner = UserSerializer(many=False)
