from rest_framework import generics
from rest_framework.exceptions import NotFound
from .serializers import UserSerializer
from users.models import USER
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

class UserListCreateView(generics.ListCreateAPIView):
    serializer_class = UserSerializer
    permission_classes = [AllowAny]
    def get_queryset(self):
        return USER.nodes.all()

    def create(self, request, *args, **kwargs):
        if not request.data.get('username'):
            return Response({'message': 'Username is required'}, status=status.HTTP_400_BAD_REQUEST)
        data = request.data.copy()  # Copy the QueryDict to a mutable dictionary
        raw_password = data['password']
        data['username'] = data['username'].lower()  # Convert username to lowercase
        print(data['username'])
        print(raw_password)
        print(data['first_name'])
        print(data['last_name'])
        print(data['age'])
        print(data['email'])
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        
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

