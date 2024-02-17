from rest_framework import generics
from .serializers import OrganizationSerializer
from .models import ORGANIZATION
from locations.models import LOCATION
from users.models import USER
from neomodel import DoesNotExist
from django.http import Http404
from rest_framework.permissions import IsAuthenticatedOrReadOnly

    

class OrganizationListCreate(generics.ListCreateAPIView):
    serializer_class = OrganizationSerializer
    # permission_classes = [IsAuthenticatedOrReadOnly]
    def get_queryset(self):
        return ORGANIZATION.nodes.all()
    def perform_create(self, serializer):
        # Save the organization instance and get the created organization
        organization = serializer.save()
        # Get the user who sent the request and the location pk
        user = self.request.user
        location_pk = self.request.data.get('pk_for_location')
        # Get the location node
        location = LOCATION.nodes.get_or_none(pk=location_pk)
        user_node = USER.nodes.get_or_none(username=user.username)
        # Associate the user with the organization as the founder
        organization.founder.connect(user_node)
        # Associate the location with the organization
        organization.location.connect(location)
    
class OrganizationDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = OrganizationSerializer
    lookup_field = 'pk'
    def get_object(self):
        try:
            obj = ORGANIZATION.nodes.get(pk=self.kwargs[self.lookup_field])
        except DoesNotExist:
            raise Http404
        return obj