from rest_framework import serializers
from teams.models import TEAM
import os
from django.utils.text import slugify
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv

load_dotenv()
AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING')


class TeamSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    men_team = serializers.BooleanField()
    founded_at = serializers.DateTimeField()
    image_url = serializers.SerializerMethodField()
    image = serializers.ImageField(use_url=True, required=False)  # Optional image fieldA


    def get_image_url(self, obj):
        if obj.image_url:
            return obj.image_url
        return None
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
        print(validated_data)
        image = validated_data.pop('image', None)
        print(image)
        if image:
            # Get the base name of the image file and the extension
            base_name, extension = os.path.splitext(image.name)
            # Sanitize the base name using Django's slugify function
            sanitized_base_name = slugify(base_name)
            # Form the new image name
            sanitized_image_name = sanitized_base_name + extension
            file_name = 'media/images/teams/' + sanitized_image_name

            # Create a blob client using the local file name as the name for the blob
            blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
            blob_client = blob_service_client.get_blob_client(os.getenv('AZURE_CONTAINER'), file_name)

            # Upload the created file
            blob_client.upload_blob(image.read())
            file_url = blob_client.url
            validated_data['image_url'] = file_url
        else:
            file_url = None

        return TEAM(**validated_data).save()

    def update(self, instance, validated_data):
        instance.name = validated_data.get('name', instance.name)
        # Update other fields as needed
        instance.save()
        return instance