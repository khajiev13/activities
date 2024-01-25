from rest_framework import serializers
from .models import CATEGORY
from users.serializers import UserSerializer

class CategorySerializer(serializers.Serializer):
    pk = serializers.CharField()
    name = serializers.CharField()
    is_indoor = serializers.BooleanField()
    is_outdoor = serializers.BooleanField()

    def create(self, validated_data):
        return CATEGORY.nodes.create(**validated_data)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['users'] = [UserSerializer(user).data for user in instance.users.all()]
        representation['activities'] = [str(activity) for activity in instance.activities.all()]
        return representation