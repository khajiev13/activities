from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from neomodel.exceptions import UniqueProperty
from .models import ACTIVITY
from .serializers import ActivitySerializer

class ActivityListCreateView(generics.ListCreateAPIView):
    """
    List all activities, or create a new activity.
    """
    queryset = ACTIVITY.nodes.all()
    serializer_class = ActivitySerializer


class ActivityDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a activity instance.
    """
    queryset = ACTIVITY.nodes.all()
    serializer_class = ActivitySerializer
    lookup_field = 'pk'

    def get_object(self):
        try:
            return ACTIVITY.nodes.get(pk=self.kwargs[self.lookup_field])
        except ACTIVITY.DoesNotExist:
            raise NotFound('Activity with id {} does not exist'.format(self.kwargs[self.lookup_field]))

    def delete(self, request, *args, **kwargs):
        activity = self.get_object()
        activity.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    






