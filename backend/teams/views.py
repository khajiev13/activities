from rest_framework.response import Response
from rest_framework import generics
from neomodel import DoesNotExist
from django.http import Http404
from core.blob_functions import delete_picture
from teams.models import TEAM
from teams.serializers import TeamListSerializer, TeamDetailSerializer
from rest_framework.permissions import BasePermission, SAFE_METHODS, IsAuthenticatedOrReadOnly
import json
from core.blob_functions import  delete_picture
from django.http import QueryDict
from core.cypher_queries import create_and_connect_nodes_for_team, get_team_detail_information
from neomodel import UniqueProperty
from datetime import datetime


#Preprocessing the data so that we will not have categories[o], categories[1], categories[2]... in the response

def preprocess_request_data(request):
    if isinstance(request.data, QueryDict):
        data = {key: value[0] for key, value in request.data.lists() if key not in ['categories', 'uniform_colors', 'image', 'sponsors']}
    else:
        data = {key: request.data[key] for key in request.data if key not in ['categories', 'uniform_colors', 'image', 'sponsors']}

    # Convert single string to list for 'belongs_to_organization' and 'location'
    for field in ['belongs_to_organization', 'location']:
        if field in data:
            data[field] = [{'pk':data[field]}]

    # Convert color fields to lists
    for field in ['tshirt_color', 'shorts_color', 'socks_color', 'away_tshirt_color']:
        if field in data:
            data[field] = [{'name':data[field]}]

    if 'categories' in request.data:
        categories = json.loads(request.data.get('categories', '[]'))
        # Parse category strings into dictionaries
        data['categories'] = [json.loads(category) if isinstance(category, str) else category for category in categories]

    if 'uniform_colors' in request.data:
        uniform_colors = json.loads(request.data.get('uniform_colors', '[]'))
        data['uniform_colors'] = [{'name': key, 'color': value} for key, value in uniform_colors.items()]

    if 'sponsors' in request.data:
        sponsors = json.loads(request.data.get('sponsors', '[]'))
        data['sponsors'] = [{'pk': sponsor} for sponsor in sponsors]
    
    if 'location' in request.data:
        location = request.data.get('location', [])
        data['location'] = [{'pk':location}]

    # Handling file upload for 'image_url'
    if 'image' in request.FILES:
        data['image'] = request.FILES['image']

    return data



class TeamUserWritePermission(BasePermission):
    message = 'Editing teams is restricted to the author only.'
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        

class TeamListCreateView(generics.ListCreateAPIView):

    permission_classes = [IsAuthenticatedOrReadOnly]
    
    def create(self, request, *args, **kwargs):
        # print(request.data)
        processed_data = preprocess_request_data(request)
        print(processed_data)
        serializer = self.get_serializer(data=processed_data)
        serializer.is_valid(raise_exception=True)
       
        try:
            team = self.perform_create(serializer)
            
        except UniqueProperty as e:
            return Response({"message": "A team with this name already exists."}, status=400)
        # Serialize the team object
        team_serializer = self.get_serializer(team)
        headers = self.get_success_headers(serializer.data) 
        return Response(team_serializer.data, status=201, headers=headers)
    def perform_create(self, serializer):
        return serializer.save()

    def get_queryset(self):
        return TEAM.nodes.all()
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TeamDetailSerializer
        return TeamListSerializer
    

class TeamDetailView(generics.RetrieveUpdateDestroyAPIView, TeamUserWritePermission):
    permission_classes = [TeamUserWritePermission]
    lookup_field = 'name'
    queryset = TEAM.nodes
    serializer_class = TeamDetailSerializer


    def get_object(self):
        try:
            team_name = self.kwargs[self.lookup_field]
            team_info = get_team_detail_information(team_name)

            # Convert 'founded_at' to datetime
            if 'founded_at' in team_info:
                team_info['founded_at'] = datetime.fromtimestamp(team_info['founded_at'])
            
            serializer = TeamDetailSerializer(data=team_info)  # Pass the data to the serializer
            serializer.is_valid(raise_exception=True)  # Raise an exception if the data is not valid
            print(team_info)
        except DoesNotExist:
            raise Http404
        
        return serializer.validated_data  # Return the validated data
    
    def destroy(self, request, *args, **kwargs):
        team = self.get_object()
        image_url = team.image_url
        success = delete_picture(image_url)
        if success:
            return super().destroy(request, *args, **kwargs)
        else:
            return Response({"message": "An error occurred while deleting the image from storage."}, status=500)
 