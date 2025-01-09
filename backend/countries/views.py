from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status
from .models import COUNTRY
from .serializers import CountrySerializer
from rest_framework.views import APIView
from core.utils import timing_decorator
import time

class CountryList(APIView):
    def get(self, request):
        print("GET request")
        start_query = time.time()

        countries = COUNTRY.get_all_countries_with_states_and_cities()
        # Convert query rows to a list of dicts:
        data = []
        for country, states, cities in countries:
            data.append({
                "country": country,
                "states": states,
                "cities": cities,
            })
            print(cities)
        serializer = CountrySerializer(data, many=True)
        response = Response(serializer.data)
        end_query = time.time()
        print(f"Query took {end_query - start_query:.4f}s")

        return response

    def post(self, request):
        serializer = CountrySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
# Create your views here.
