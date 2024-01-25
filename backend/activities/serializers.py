from rest_framework import serializers

from categories.serializers import CategorySerializer
from .models import ACTIVITY
from neomodel.core import DoesNotExist
from locations.serializers import LocationSerializer
from users.serializers import UserSerializer

class ActivitySerializer(serializers.Serializer):
    pk = serializers.CharField(read_only=True)
    title = serializers.CharField(required=True)
    description = serializers.CharField(required=True)
    duration_in_minutes = serializers.IntegerField(required=True)
    public = serializers.BooleanField(default=True)
    date_time = serializers.DateTimeField(required=True, format="%Y-%m-%d %H:%M:%S")
    location = serializers
    def create(self, validated_data):
        return ACTIVITY.nodes.create(**validated_data)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        try:
            representation['location'] = instance.location.get().name
            representation['category'] = [category.name for category in instance.category.all()]
            representation['joined_people'] = [{'image_url': user.image_url, 'username': user.username} for user in instance.people_joined.all()]
        except DoesNotExist:
            representation['location'] = 'No location provided or it might be online!'
        return representation