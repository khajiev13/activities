from rest_framework import serializers
from users.models import USER
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, PasswordField
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import exceptions
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from urllib.parse import quote
import os
from django.utils.text import slugify
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv

load_dotenv()
AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING')



class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    # username_field = USER.username

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields[self.username_field] = serializers.CharField()
        self.fields['password'] = PasswordField()

    @classmethod
    def get_token(cls, user):
        # Override the method to use username instead of id
        token = RefreshToken()
        token['username'] = user.username
        token['first_name'] = user.first_name
        token['last_name'] = user.last_name
        token['image_url'] = user.image_url
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        username = attrs.get('username')
        password = attrs.get('password')

        try:
            user = USER.nodes.get(username=username)
            if user.check_password(password):
                data['username'] = self.user.username
                data['first_name'] = self.user.first_name
                data['last_name'] = self.user.last_name
                data['image_url'] = self.user.image_url
                return data
        except USER.DoesNotExist:
            raise exceptions.AuthenticationFailed('No such user')

        raise exceptions.AuthenticationFailed('Incorrect password')

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, write_only=True)
    first_name = serializers.CharField(max_length=30)
    last_name = serializers.CharField(max_length=30)
    date = serializers.DateField()
    gender = serializers.CharField(max_length=10)
    email = serializers.EmailField()
    image = serializers.ImageField(use_url=True, required=False)  # Optional image fieldA
    image_url = serializers.SerializerMethodField()
    def get_image_url(self, obj):
        if obj.image_url:
            return obj.image_url
        return None


    def create(self, validated_data):
        image = validated_data.pop('image', None)
        if image:
            # Get the base name of the image file and the extension
            base_name, extension = os.path.splitext(image.name)
            # Sanitize the base name using Django's slugify function
            sanitized_base_name = slugify(base_name)
            # Form the new image name
            sanitized_image_name = sanitized_base_name + extension
            file_name = 'media/images/users/' + sanitized_image_name

            # Create a blob client using the local file name as the name for the blob
            blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
            blob_client = blob_service_client.get_blob_client(os.getenv('AZURE_CONTAINER'), file_name)

            # Upload the created file
            blob_client.upload_blob(image.read())
            file_url = blob_client.url
        else:
            file_url = None

        # Create the user instance
        user = USER(
            username=validated_data['username'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            date=validated_data['date'],
            gender=validated_data['gender'],
            email=validated_data['email'],
            image_url=file_url  # Assume USER model has `image_url` field
        )
        user.set_password(validated_data['password'])
        user.save()
        return user

    def update(self, instance, validated_data):
        # Handle image upload if it's being updated
        image = validated_data.pop('image', None)
        if image:
            
            image_name = quote(image.name, safe='/:') #This is to avoid spaces in the url
            file_name = 'media/images/users/' + image_name  # Add 'images/' prefix to the file name
            file_name = default_storage.save(file_name, ContentFile(image.read()))
            file_url = default_storage.url(file_name)
            instance.image_url = file_url  # Update the image_url field

        if 'password' in validated_data:
            instance.set_password(validated_data['password'])
            validated_data.pop('password')

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance