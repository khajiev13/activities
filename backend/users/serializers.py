from rest_framework import serializers
from users.models import USER
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, PasswordField
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import exceptions
from storages.backends.gcloud import GoogleCloudStorage
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage



class MyGoogleCloudStorage(GoogleCloudStorage):
    def url(self, name):
        return f'https://storage.googleapis.com/{self.bucket_name}/{name}'




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
            storage = MyGoogleCloudStorage()
            return storage.url(obj.image_url)
        return None


    def create(self, validated_data):
        
        # Handle image upload
        image = validated_data.pop('image', None)
        if image:
            # No more default_storage, we're using our custom, snazzy storage now
            storage = MyGoogleCloudStorage()
            file_name = 'media/images/users/' + image.name
            # Save the image and read its contents, as if whispering sweet nothings to it
            file_name = storage.save(file_name, ContentFile(image.read()))
            # Grab the URL, which should now be as short and sweet as a haiku
            file_url = file_name
        else:
            # If there's no image, let's not make a mountain out of a molehill
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
            file_name = 'media/images/users/' + image.name  # Add 'images/' prefix to the file name
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