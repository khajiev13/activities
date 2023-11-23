from django.contrib.auth.backends import ModelBackend
from users.models import USER
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication



class CustomJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        username = validated_token['username']
        return USER.nodes.get(username=username)

class CustomRefreshToken(RefreshToken):
    @property
    def access_token(self):
        token = super().access_token
        token['username'] = self.user.username
        return token
        

class UserAuthentication(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if (username is None) or (password is None):
            return None
        try:
            user = USER.nodes.get(username=username)
            if user.check_password(password):
                print("Password matched and correct")
                return user
        except USER.DoesNotExist:
            print("User does not exist")
            return None
    
    def get_user(self, username):
        try:
            print("Get user function is being called in authentication.py")
            user = USER.nodes.get(username=username)
            return user
        except USER.DoesNotExist:
            print("RETURNED NONE IN get_user")
            return None
    def authenticate_header(self, request):
        print("Authenticate header is being called")
        return 'Bearer'



