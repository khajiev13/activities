from rest_framework import viewsets
from rest_framework.response import Response
from .models import LOCATION  # Make sure to import your LOCATION model
from .serializers import LocationSerializer  # Assuming you have a LocationSerializer
from rest_framework import status
from rest_framework.permissions import AllowAny

class LocationViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    queryset = LOCATION.nodes.all()
    def list(self, request):
        serializer = LocationSerializer(LOCATION.nodes.all(), many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        # Retrieve a single LOCATION node by pk
        try:
            location = LOCATION.nodes.get(pk=pk)
        except LOCATION.DoesNotExist:
            return Response({'message': 'Location not found'}, status=404)

        serializer = LocationSerializer(location)
        return Response(serializer.data)
    
    def create(self, request):
        serializer = LocationSerializer(data=request.data)
        if serializer.is_valid():
            location = serializer.save()
            return Response(LocationSerializer(location).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    def update(self, request, pk=None):
        try:
            location = LOCATION.nodes.get(pk=pk)
        except LOCATION.DoesNotExist:
            return Response({'message': 'Location not found'}, status=404)
        serializer = LocationSerializer(location, data=request.data)
        if serializer.is_valid():
            location = serializer.save()
            return Response(LocationSerializer(location).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, pk=None):
        try:
            location = LOCATION.nodes.get(pk=pk)
        except LOCATION.DoesNotExist:
            return Response({'message': 'Location not found'}, status=404)
        location.delete()
        return Response({'message': 'Location deleted'}, status=204)
    # def get_permissions(self):
    #     """
    #     Instantiates and returns the list of permissions that this view requires.
    #     """
    #     if self.action == 'list':
    #         permission_classes = [IsAuthenticated]
    #     else:
    #         permission_classes = [IsAdminUser]
    #     return [permission() for permission in permission_classes]

    # Add 'create', 'update', 'delete' if needed
