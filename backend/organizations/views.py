from requests import Response
from rest_framework import generics
from core.blob_functions import delete_picture
from .serializers import OrganizationSerializer
from .models import ORGANIZATION
from locations.models import LOCATION
from users.models import USER
from neomodel import DoesNotExist
from django.http import Http404
from django.views import View
from django.http import JsonResponse
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from countries.models import COUNTRY
from organizations.cypher_queries import list_organizations_by_country


class ListOrganizations(View):
    def get(self, request):
        queryset = ORGANIZATION.nodes.all()
        data = [{"pk": org.pk, "name": org.name} for org in queryset]
        return JsonResponse(data, safe=False)


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
        country_name = self.request.data.get('country')
        state_name = self.request.data.get('state')
        city_name = self.request.data.get('city')
        # Get the location node
        location = LOCATION.nodes.get_or_none(pk=location_pk)
        user_node = USER.nodes.get_or_none(username=user.username)
        country = COUNTRY.nodes.get_or_none(name=country_name)
        state = country.states.get_or_none(name=state_name)
        city = state.cities.get_or_none(name=city_name)
        # Associate the user with the organization as the founder
        organization.founder.connect(user_node)
        # Associate the location with the organization
        organization.location.connect(location)
        # Associate the organization with the country
        organization.country.connect(country)
        # Associate the organization with the state
        organization.state.connect(state)
        # Associate the organization with the city
        organization.city.connect(city)
        organization.save()


class OrganizationDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = OrganizationSerializer
    lookup_field = 'pk'

    def get_object(self):
        try:
            obj = ORGANIZATION.nodes.get(pk=self.kwargs[self.lookup_field])
        except DoesNotExist:
            raise Http404
        return obj

    def destroy(self, request, *args, **kwargs):
        organization = self.get_object()
        image_url = organization.image_url
        success = delete_picture(image_url)
        if success:
            return super().destroy(request, *args, **kwargs)
        else:
            return Response({"message": "An error occurred while deleting the image from storage."}, status=500)

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
                organizations = list_organizations_by_country(countries)
            elif states:
                # Get the countries from params
                countries = request.query_params.getlist('countries[]')
                # Convert the string to a list of states before pasing it to a function
                states = [state.strip() for state in states.split(",")]
                print(countries, states)
                organizations = list_organizations_by_state(countries, states)
            elif cities:
                # Convert the string to a list of cities before pasing it to a function
                cities = [city.strip() for city in cities.split(",")]
                # Get the countries and states from params
                countries = request.query_params.getlist('countries[]')
                states = request.query_params.getlist('states[]')
                organizations = list_organizations_by_city(
                    countries, states, cities)
            elif search_name:
                organizations = list_teams_by_name(search_name)
            serializer = OrganizationSerializer(organizations, many=True)
            return Response(serializer.data)

        except DoesNotExist:
            return Response({'error': 'The specified country, state, or city does not exist.'}, status=404)
