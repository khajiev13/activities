from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from neomodel.exceptions import UniqueProperty
from .models import ACTIVITY
from .serializers import ActivitySerializer
from .cypher_queries import list_activities_by_country, list_activities_by_state, list_activities_by_city, list_activities_by_name
from neomodel import DoesNotExist
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from drf_spectacular.types import OpenApiTypes




class ActivityListCreateView(generics.ListCreateAPIView):
    """
    List all activities, or create a new activity.
    """
    queryset = ACTIVITY.nodes.all()
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]


    @extend_schema(
        summary="Create new activity",
        description="Creates a new activity with the provided data",
        request=ActivitySerializer,
        responses={
            201: ActivitySerializer,
            400: {"description": "Bad Request - Invalid data"}
        },
        examples=[
            OpenApiExample(
                'Valid Activity',
                value={
                    'title': 'Football Match',
                    'description': 'Friendly match',
                    'date_time': '2024-03-22T15:00:00Z'
                }
            )
        ],
        methods=["POST"]
    )
    def post(self, request, *args, **kwargs):
        activityserializer = ActivitySerializer(data=request.data)
        # Get the current user's username
        if 'creator' not in activityserializer.initial_data:
            activityserializer.initial_data['creator'] = {}
        activityserializer.initial_data['creator']['username'] = request.user.username
        if activityserializer.is_valid():
            # This calls the `create` method on the serializer
            activity = activityserializer.save()
            return Response(activity, status=status.HTTP_201_CREATED)
        return Response(activityserializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get_queryset(self):
        return ACTIVITY.nodes.all()

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
            if countries:
                # Convert the string to a list of countries before pasing it to a function
                countries = [country.strip()
                             for country in countries.split(",")]
                teams = list_activities_by_country(countries)
            elif states:
                # Get the countries from params
                countries = request.query_params.getlist('countries[]')
                # Convert the string to a list of states before pasing it to a function
                states = [state.strip() for state in states.split(",")]
                teams = list_activities_by_state(countries, states)
            elif cities:
                # Convert the string to a list of cities before pasing it to a function
                cities = [city.strip() for city in cities.split(",")]
                # Get the countries and states from params
                countries = request.query_params.getlist('countries[]')
                states = request.query_params.getlist('states[]')
                teams = list_activities_by_city(countries, states, cities)
            elif search_name:
                teams = list_activities_by_name(search_name)
            serializer = ActivitySerializer(teams, many=True)
            return Response(serializer.data)

        except DoesNotExist:
            return Response({'error': 'The specified country, state, or city does not exist.'}, status=404)


class ActivityDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a activity instance.
    """
    queryset = ACTIVITY.nodes.all()
    serializer_class = ActivitySerializer
    permission_classes = (AllowAny,)
    lookup_field = 'pk'
    def get_object(self):
        try:
            return ACTIVITY.nodes.get(pk=self.kwargs[self.lookup_field])
        except ACTIVITY.DoesNotExist:
            raise NotFound('Activity with id {} does not exist'.format(self.kwargs[self.lookup_field]))
        
    @extend_schema(
        summary="Retrieve activity",
        description="Get details of a specific activity by ID",
        parameters=[
            OpenApiParameter(
                name="pk",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.PATH,
                description="Activity unique identifier"
            )
        ],
        responses={
            200: ActivitySerializer,
            404: {"description": "Activity not found"}
        },
        methods=["GET"]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


    @extend_schema(
        summary="Delete activity",
        description="Delete an activity by ID",
        parameters=[
            OpenApiParameter(
                name="pk",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.PATH,
                description="Activity unique identifier"
            )
        ],
        responses={
            204: None,
            404: {"description": "Activity not found"}
        },
        methods=["DELETE"]
    )
    def delete(self, request, *args, **kwargs):
        activity = self.get_object()
        activity.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class JoinActivityView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, pk, format=None):
        try:
            activity = ACTIVITY.nodes.get(pk=pk)
        except DoesNotExist:
            raise NotFound('Activity with id {} does not exist'.format(pk))

        activity.join_activity(request.user)
        return Response({'message': 'You have successfully joined the activity.'}, status=status.HTTP_200_OK)


class LeaveActivityView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, pk, format=None):
        try:
            activity = ACTIVITY.nodes.get(pk=pk)
        except DoesNotExist:
            raise NotFound('Activity with id {} does not exist'.format(pk))

        activity.leave_activity(request.user)
        return Response({'message': 'You have successfully left the activity.'}, status=status.HTTP_200_OK)