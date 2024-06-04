from rest_framework import viewsets
from rest_framework.response import Response
from .models import LOCATION  # Make sure to import your LOCATION model
from countries.models import COUNTRY
from .serializers import LocationSerializer  # Assuming you have a LocationSerializer
from rest_framework import status
from rest_framework.permissions import AllowAny
from neomodel import db
from neomodel.exceptions import UniqueProperty
import uuid
from rest_framework.decorators import action
from countries.serializers import CountrySerializer



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
        country_name = request.data.get('country')
        state_name = request.data.get('state')
        city_name = request.data.get('city')
        longitude = request.data.get('longitude')
        latitude = request.data.get('latitude')
        location_name = request.data.get('name')

        # Begin the transaction
        try:
            with db.transaction:
                pk = str(uuid.uuid4())
                params = {
                    "pk": pk,
                    "countryName": country_name,
                    "stateName": state_name,
                    "cityName": city_name,
                    "locationName": location_name,
                    "longitude": longitude,
                    "latitude": latitude
                }

                query = """
                    MERGE (country:COUNTRY {name: $countryName})
                    MERGE (state:STATE {name: $stateName})-[:IS_IN]->(country)
                    MERGE (city:CITY {name: $cityName})-[:IS_IN]->(state)
                    MERGE (location:LOCATION {pk: $pk, name: $locationName, points: point({ longitude: $longitude, latitude: $latitude })})-[:IS_IN]->(city)
                    RETURN location.pk, location.name
                """
                results, meta = db.cypher_query(query, params)
                location_pk, location_name = results[0]
                response_data = {
                    'country': country_name,
                    'state': state_name,
                    'city': city_name,
                    'location_pk': location_pk,
                    'location_name': location_name,
                }

                return Response(response_data, status=status.HTTP_201_CREATED)
        except UniqueProperty as e:
            return Response({'error': 'Constraint violation: ' + str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # If anything goes wrong, return an error response
            print(e)

            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
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
    
    @action(detail=False, methods=['get'], url_path='countries-states-cities')
    def countries_states_cities(self, request):
        countries = COUNTRY.nodes.all()
        serializer = CountrySerializer(countries, many=True)
        return Response(serializer.data)
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
