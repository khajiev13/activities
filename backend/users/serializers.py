from rest_framework import serializers
from users.models import USER
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, PasswordField
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

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
        return token

    def validate(self, attrs):
        print("Custom Token Obtain Pair Serializer is being called")
        data = super().validate(attrs)
        username = attrs.get('username')
        password = attrs.get('password')

        try:
            user = USER.nodes.get(username=username)
            if user.check_password(password):
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
    age = serializers.IntegerField()
    gender = serializers.CharField(max_length=10)
    email = serializers.EmailField()

    def create(self, validated_data):
        password = serializers.CharField(write_only=True)
        user = USER(
            username=validated_data['username'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            age=validated_data['age'],
            gender=validated_data['gender'],
            email=validated_data['email']
        )
        user.set_password(validated_data['password'])
        user.save()
        return user

    def update(self, instance, validated_data):
        if 'password' in validated_data:
            instance.set_password(validated_data['password'])
            validated_data.pop('password')
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance