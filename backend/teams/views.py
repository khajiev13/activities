from rest_framework.response import Response
from rest_framework import generics
from django.http import Http404
from core.blob_functions import delete_picture
from teams.models import TEAM
from teams.serializers import TeamListSerializer, TeamDetailSerializer
from rest_framework.permissions import BasePermission, SAFE_METHODS, IsAuthenticatedOrReadOnly
import json
from core.blob_functions import delete_picture
from django.http import QueryDict
from teams.cypher_queries import get_team_detail_information, list_teams_by_country, list_teams_by_state, list_teams_by_city, list_teams_by_name
from neomodel import UniqueProperty, DoesNotExist
from rest_framework import status
from teams.serializers import TeamListSerializer
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound


# Preprocessing the data so that we will not have categories[o], categories[1], categories[2]... in the response

def preprocess_request_data(request):
    if isinstance(request.data, QueryDict):
        data = {key: value[0] for key, value in request.data.lists(
        ) if key not in ['categories', 'uniform_colors', 'image', 'sponsors']}
    else:
        data = {key: request.data[key] for key in request.data if key not in [
            'categories', 'uniform_colors', 'image', 'sponsors']}

    # Convert single string to list for 'belongs_to_organization' and 'location'
    for field in ['belongs_to_organization', 'location']:
        if field in data:
            data[field] = [{'pk': data[field]}]

    # Convert color fields to lists
    for field in ['tshirt_color', 'shorts_color', 'socks_color', 'away_tshirt_color']:
        if field in data:
            data[field] = [{'name': data[field]}]

    if 'categories' in request.data:
        categories = json.loads(request.data.get('categories', '[]'))
        # Parse category strings into dictionaries
        data['categories'] = [json.loads(category) if isinstance(
            category, str) else category for category in categories]

    if 'uniform_colors' in request.data:
        uniform_colors = json.loads(request.data.get('uniform_colors', '[]'))
        data['uniform_colors'] = [{'name': key, 'color': value}
                                  for key, value in uniform_colors.items()]

    if 'sponsors' in request.data:
        sponsors = json.loads(request.data.get('sponsors', '[]'))
        data['sponsors'] = [{'pk': sponsor} for sponsor in sponsors]

    if 'location' in request.data:
        location = request.data.get('location', [])
        data['location'] = [{'pk': location}]

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
        # If the team is not creating successfully then check the uniform colors.
        processed_data = preprocess_request_data(request)
        serializer = self.get_serializer(data=processed_data)
        serializer.is_valid(raise_exception=True)

        try:
            team = self.perform_create(serializer)

        except UniqueProperty as e:
            return Response({"message": "A team with this name already exists."}, status=status.HTTP_409_CONFLICT)
        # Serialize the team object
        team_serializer = self.get_serializer(team)
        headers = self.get_success_headers(serializer.data)
        return Response(team_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        return serializer.save()

    def get_queryset(self):
        return TEAM.nodes.all()

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TeamDetailSerializer
        return TeamListSerializer

    def list(self, request, *args, **kwargs):
        try:
            # Check if the request is for a specific country, state, or city
            # Country might be a list of countries
            countries = self.kwargs.get('countries', None)
            # State might be a list of states
            states = self.kwargs.get('states', None)
            # City might be a list of cities
            cities = self.kwargs.get('cities', None)
            search_name = self.kwargs.get('search', None)
            print(countries, states, cities)
            if countries:
                # Convert the string to a list of countries before pasing it to a function
                countries = [country.strip()
                             for country in countries.split(",")]
                teams = list_teams_by_country(countries)
            elif states:
                # Get the countries from params
                countries = request.query_params.getlist('countries[]')
                # Convert the string to a list of states before pasing it to a function
                states = [state.strip() for state in states.split(",")]
                print(countries, states)
                teams = list_teams_by_state(countries, states)
            elif cities:
                # Convert the string to a list of cities before pasing it to a function
                cities = [city.strip() for city in cities.split(",")]
                # Get the countries and states from params
                countries = request.query_params.getlist('countries[]')
                states = request.query_params.getlist('states[]')
                teams = list_teams_by_city(countries, states, cities)
            elif search_name:
                teams = list_teams_by_name(search_name)
            serializer = TeamListSerializer(teams, many=True)
            return Response(serializer.data)

        except DoesNotExist:
            return Response({'error': 'The specified country, state, or city does not exist.'}, status=404)


class TeamDetailView(generics.RetrieveUpdateDestroyAPIView, TeamUserWritePermission):
    permission_classes = [TeamUserWritePermission]
    lookup_field = 'name'
    queryset = TEAM.nodes
    serializer_class = TeamDetailSerializer

    def get_object(self):
        try:
            team_name = self.kwargs[self.lookup_field]
            team_info = get_team_detail_information(team_name)
            # Pass the data to the serializer
            serializer = TeamDetailSerializer(data=team_info)
            # Raise an exception if the data is not valid
            serializer.is_valid(raise_exception=True)
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


class JoinLeaveTeamView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, team_name, format=None):
        try:
            team = TEAM.nodes.get(name=team_name)
        except DoesNotExist:
            raise NotFound(
                'Activity with id {} does not exist'.format(team_name))

        joined = team.join_leave_team_toggle(request.user)
        if (joined):
            return Response({'message': 'You have successfully joined the team.'}, status=status.HTTP_200_OK)
        else:
            return Response({'message': 'You have successfully left the team.'}, status=status.HTTP_200_OK)
