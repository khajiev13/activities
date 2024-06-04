from rest_framework import serializers
import os
from dotenv import load_dotenv
from core.blob_functions import create_image
from teams.models import TEAM
from locations.serializers import LocationSerializer
from colors.serializers import ColorSerializer
from categories.serializers import CategorySerializer
from teams.cypher_queries import create_and_connect_nodes_for_team
from core.blob_functions import delete_picture
from locations.serializers import LocationSerializer
from colors.serializers import ColorSerializer
from categories.serializers import CategorySerializer

load_dotenv()
AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING')


class TeamListSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    men_team = serializers.BooleanField()
    founded_at = serializers.DateField()
    image_url = serializers.CharField(allow_null=True, required=False)
    public_team = serializers.BooleanField()
    tshirt_color = ColorSerializer(many=True)
    shorts_color = ColorSerializer(many=True)
    away_tshirt_color = ColorSerializer(many=True)
    socks_color = ColorSerializer(many=True)
    country_name = serializers.StringRelatedField()
    state_name = serializers.StringRelatedField()
    city_name = serializers.StringRelatedField()
    location = LocationSerializer(many=True)
    categories = CategorySerializer(many=True)


class TeamDetailSerializer(serializers.Serializer):
    name = serializers.CharField()
    men_team = serializers.BooleanField()
    founded_at = serializers.DateTimeField(required=False)
    image_url = serializers.CharField(allow_null=True, required=False)
    city_name = serializers.CharField()
    state_name = serializers.CharField()
    country_name = serializers.CharField()
    image = serializers.ImageField(use_url=True, required=False)
    public_team = serializers.BooleanField()
    categories = CategorySerializer(many=True)
    tshirt_color = ColorSerializer(many=True)
    shorts_color = ColorSerializer(many=True)
    socks_color = ColorSerializer(many=True)
    away_tshirt_color = ColorSerializer(many=True)
    sponsors = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField()))
    belongs_to_organization = serializers.ListField(child=serializers.DictField(
        child=serializers.CharField(allow_blank=True, required=False)), required=False)
    location = LocationSerializer(many=True)

    def create(self, validated_data):
        image = validated_data.pop('image', None)
        if image:
            validated_data['image_url'] = create_image(image, 'teams')
        team = TEAM(**validated_data)
        success = create_and_connect_nodes_for_team(team)
        if success:
            print('Team created successfully')
        else:
            # delete the picture if the team was not created
            if 'image_url' in validated_data:
                delete_picture(validated_data['image_url'])
            print('Error creating team')
        return team

    def update(self, instance, validated_data):
        instance.name = validated_data.get('name', instance.name)
        # Update other fields as needed
        instance.save()
        return instance


class TeamCustomSerializer(serializers.Serializer):
    name = serializers.CharField(
        allow_null=True, max_length=200, required=False)
    image_url = serializers.CharField(allow_null=True, required=False)
