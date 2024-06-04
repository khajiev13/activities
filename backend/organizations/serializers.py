
from .models import ORGANIZATION
from rest_framework import serializers
from locations.serializers import LocationSerializer
from django.utils.text import slugify
from azure.storage.blob import BlobServiceClient

from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from urllib.parse import quote
from dotenv import load_dotenv
import os
from users.serializers import UserSerializer
from teams.serializers import TeamListSerializer
# from activities.serializers import ActivitySerializer
# from leagues.serializers import LeagueSerializer
from countries.serializers import CountrySerializer
from states.serializers import StateSerializer
from cities.serializers import CitySerializer


load_dotenv()
AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING')


class OrganizationSerializer(serializers.Serializer):

    pk = serializers.CharField(required=False)
    name = serializers.CharField()
    # location_details = serializers.SerializerMethodField()
    created_at = serializers.DateField(required=False)
    image_url = serializers.StringRelatedField()
    image = serializers.ImageField(
        use_url=True, required=False)  # Optional image field
    location = LocationSerializer(many=False, required=False)
    country = CountrySerializer(many=False, required=False)
    state = StateSerializer(many=False, required=False)
    city = CitySerializer(many=False, required=False)
    members = UserSerializer(many=True, required=False)
    founder = UserSerializer(many=True, required=False)
    sponsors_teams = TeamListSerializer(many=True, required=False)
    sponsort_teams_count = serializers.IntegerField(required=False)
    # hosting_leagues = LeagueSerializer(many=True, required=False)
    # hosting_activities = ActivitySerializer(many=True, required=False)
    hosting_activities_count = serializers.IntegerField(required=False)
    members_count = serializers.IntegerField(required=False)
    # def get_location_details(self, obj):
    #     location = obj.location.single()
    #     return LocationSerializer(location).data

    def create(self, validated_data):
        image = validated_data.pop('image', None)
        print(image)
        if image:
            # Get the base name of the image file and the extension
            base_name, extension = os.path.splitext(image.name)
            # Sanitize the base name using Django's slugify function
            sanitized_base_name = slugify(base_name)
            # Form the new image name
            sanitized_image_name = sanitized_base_name + extension
            file_name = 'media/images/organizations/' + sanitized_image_name

            # Create a blob client using the local file name as the name for the blob
            blob_service_client = BlobServiceClient.from_connection_string(
                AZURE_STORAGE_CONNECTION_STRING)
            blob_client = blob_service_client.get_blob_client(
                os.getenv('AZURE_CONTAINER'), file_name)

            # Upload the created file
            blob_client.upload_blob(image.read())
            file_url = blob_client.url
        else:
            file_url = None

        # Create the organization instance
        organization = ORGANIZATION(
            name=validated_data['name'],

            image_url=file_url  # Assume ORGANIZATION model has `image_url` field
        )
        organization.save()
        return organization

    def update(self, instance, validated_data):
        # Handle image upload if it's being updated
        image = validated_data.pop('image', None)
        if image:

            # This is to avoid spaces in the url
            image_name = quote(image.name, safe='/:')
            # Add 'images/' prefix to the file name
            file_name = 'media/images/users/' + image_name
            file_name = default_storage.save(
                file_name, ContentFile(image.read()))
            file_url = default_storage.url(file_name)
            instance.image_url = file_url  # Update the image_url field
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
