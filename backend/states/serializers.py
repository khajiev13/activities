from rest_framework import serializers
from cities.serializers import CitySerializer


class StateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    cities = CitySerializer(many=True, required=False)
