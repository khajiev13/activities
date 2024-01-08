from rest_framework import generics
from neomodel import DoesNotExist
from django.http import Http404
from teams.models import TEAM
from teams.serializers import TeamSerializer
from rest_framework.permissions import BasePermission, SAFE_METHODS


class TeamUserWritePermission(BasePermission):
    message = 'Editing teams is restricted to the author only.'
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        

class TeamListCreateView(generics.ListCreateAPIView):
    serializer_class = TeamSerializer
    def get_queryset(self):
        return TEAM.nodes.all()

class TeamDetailView(generics.RetrieveUpdateDestroyAPIView, TeamUserWritePermission):
    permission_classes = [TeamUserWritePermission]
    lookup_field = 'name'
    queryset = TEAM.nodes
    serializer_class = TeamSerializer
    def get_object(self):
        try:
            obj = TEAM.nodes.get(name=self.kwargs[self.lookup_field])
        except DoesNotExist:
            raise Http404
        return obj