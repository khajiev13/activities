from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import CITY, STATE
from countries.models import COUNTRY

class ChooseCityView(APIView):
    def post(self, request, *args, **kwargs):
        country_name = request.data.get('country')
        state_name = request.data.get('state')
        city_name = request.data.get('city')

        country, created = COUNTRY.nodes.get_or_create(name=country_name)
        state, created = country.states.get_or_create(name=state_name)
        city, created = state.cities.get_or_create(name=city_name)

        return Response({
            'country': {'name': country.name},
            'state': {'name': state.name},
            'city': {'name': city.name},
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)