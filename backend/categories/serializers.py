from rest_framework import serializers
from .models import CATEGORY


class CategorySerializer(serializers.Serializer):
    pk = serializers.CharField(required=False)
    name = serializers.CharField()
    is_indoor = serializers.BooleanField()
    is_outdoor = serializers.BooleanField()
    is_online = serializers.BooleanField()

    def create(self, validated_data):
        category = CATEGORY(**validated_data)
        category.save()
        return category

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance