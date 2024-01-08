from rest_framework import serializers
from teams.models import TEAM

class TeamSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    men_team = serializers.BooleanField()
    founded_at = serializers.DateTimeField()
    def get_tshirt_color(self, obj):
        return [color.name for color in obj.tshirt_color.all()]

    def get_shorts_color(self, obj):
        return [color.name for color in obj.shorts_color.all()]

    def get_socks_color(self, obj):
        return [color.name for color in obj.socks_color.all()]
    tshirt_color = serializers.SerializerMethodField('get_tshirt_color')
    shorts_color = serializers.SerializerMethodField('get_shorts_color')
    socks_color = serializers.SerializerMethodField('get_socks_color')
    # Add other fields as needed

    def create(self, validated_data):
        return TEAM(**validated_data).save()

    def update(self, instance, validated_data):
        instance.name = validated_data.get('name', instance.name)
        # Update other fields as needed
        instance.save()
        return instance