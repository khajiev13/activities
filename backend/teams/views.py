from rest_framework import generics
<<<<<<< HEAD
from neomodel import DoesNotExist, db

from django.http import Http404
from teams.models import TEAM
from users.models import USER
from teams.serializers import TeamListSerializer , TeamDetailSerializer
=======
from neomodel import DoesNotExist
from django.http import Http404
from teams.models import TEAM
from teams.serializers import TeamSerializer
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
from rest_framework.permissions import BasePermission, SAFE_METHODS


class TeamUserWritePermission(BasePermission):
    message = 'Editing teams is restricted to the author only.'
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        

class TeamListCreateView(generics.ListCreateAPIView):
<<<<<<< HEAD
    serializer_class = TeamListSerializer
    
    def get_queryset(self):
        results, cols = db.cypher_query("""
            MATCH (team:TEAM)
            OPTIONAL MATCH (team)-[rel]-(neighbor)
            RETURN team, collect({relationship: type(rel), neighbor: neighbor})
        """)
        # print(results)
        print(cols)
        teams = []
        for row in results:
            team = TEAM.inflate(row[0])
            relationships = row[1]
            # Here you would need to manually inflate the relationships and add them to the team object
            # This will depend on how your TEAM model and its relationships are set up
            # For example:
            for rel in relationships:
                if rel['relationship'] == 'JOINS':
                    team.people_joined.connect(USER.inflate(rel['neighbor']))
                # Add more conditions here for other relationship types
            teams.append(team)
        print(teams)
        return teams
=======
    serializer_class = TeamSerializer
    def get_queryset(self):
        return TEAM.nodes.all()
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010

class TeamDetailView(generics.RetrieveUpdateDestroyAPIView, TeamUserWritePermission):
    permission_classes = [TeamUserWritePermission]
    lookup_field = 'name'
    queryset = TEAM.nodes
<<<<<<< HEAD
    serializer_class = TeamDetailSerializer
=======
    serializer_class = TeamSerializer
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
    def get_object(self):
        try:
            obj = TEAM.nodes.get(name=self.kwargs[self.lookup_field])
        except DoesNotExist:
            raise Http404
        return obj