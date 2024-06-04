from rest_framework import generics
from rest_framework.exceptions import NotFound

from core.blob_functions import delete_picture
from .serializers import UserSerializer
from users.models import USER
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from neomodel.exceptions import UniqueProperty
from rest_framework_simplejwt.tokens import RefreshToken
import logging


class UserListCreateView(generics.ListCreateAPIView):
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return USER.nodes.all()

    def create(self, request, *args, **kwargs):
        try:
            if not request.data.get('username'):
                return Response({'message': 'Username is required'}, status=status.HTTP_400_BAD_REQUEST)
            data = dict(request.data.items())
            raw_password = data['password']
            # Convert username to lowercase
            data['username'] = data['username'].lower()
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except UniqueProperty as e:
            return Response({"message": str(e)}, status=status.HTTP_409_CONFLICT)

    def perform_create(self, serializer):
        user = serializer.save()


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    lookup_field = 'username'
    serializer_class = UserSerializer

    def get_queryset(self):
        return USER.nodes.all()

    def get_object(self):
        try:
            return USER.nodes.get(username=self.kwargs[self.lookup_field])
        except USER.DoesNotExist:
            raise NotFound('A user with this username does not exist.')

    def destroy(self, request, *args, **kwargs):
        organization = self.get_object()
        image_url = organization.image_url
        success = delete_picture(image_url)
        if success:
            return super().destroy(request, *args, **kwargs)
        else:
            return Response({"message": "An error occurred while deleting the image from storage."}, status=500)


class BlacklistTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh_token")
            if not refresh_token:
                return Response({"message": "Refresh token is required"}, status=status.HTTP_400_BAD_REQUEST)

            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Success"}, status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            logging.error(f"Error blacklisting token: {e}")
            return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
