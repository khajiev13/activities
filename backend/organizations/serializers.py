
from rest_framework import serializers
from locations.serializers import LocationSerializer
from django.utils.text import slugify
from azure.storage.blob import BlobServiceClient
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from urllib.parse import quote
from dotenv import load_dotenv
import os

load_dotenv()
AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING')


class OrganizationSerializer(serializers.ModelSerializer):
    name = serializers.CharField()
    created_at = serializers.DateField()

from rest_framework import serializers
from .models import ORGANIZATION

class OrganizationSerializer(serializers.Serializer):
    
    pk = serializers.CharField(required=False)
    name = serializers.CharField()
    location_details = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    image = serializers.ImageField(use_url=True, required=False)  # Optional image fieldA


    def get_image_url(self, obj):
        if obj.image_url:
            return obj.image_url
        return None

    def get_created_at(self, obj):
        return obj.created_at

    def get_location_details(self, obj):
        location = obj.location.single()
        return LocationSerializer(location).data
    
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
            blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
            blob_client = blob_service_client.get_blob_client(os.getenv('AZURE_CONTAINER'), file_name)

            # Upload the created file
            blob_client.upload_blob(image.read())
            file_url = blob_client.url
        else:
            file_url = None


        print(validated_data)

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
            
            image_name = quote(image.name, safe='/:') #This is to avoid spaces in the url
            file_name = 'media/images/users/' + image_name  # Add 'images/' prefix to the file name
            file_name = default_storage.save(file_name, ContentFile(image.read()))
            file_url = default_storage.url(file_name)
            instance.image_url = file_url  # Update the image_url field
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance