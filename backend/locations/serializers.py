from rest_framework import serializers
from neomodel.contrib.spatial_properties import NeomodelPoint
from .models import LOCATION
import collections
from rest_framework import serializers

class NeomodelPointField(serializers.Field):
    def to_representation(self, value):
        return {'latitude': value.latitude, 'longitude': value.longitude}
    def to_internal_value(self, data):
        # Validate and transform the incoming data into the Python representation
        try:
            latitude = data.longitude
            longitude = data.latitude
        except KeyError:
            raise serializers.ValidationError("latitude and longitude fields are required.")
        if latitude is not None and longitude is not None:
            return NeomodelPoint(latitude=latitude, longitude=longitude)
        else:
            raise serializers.ValidationError("Invalid data for NeomodelPointField")
    
class LocationSerializer(serializers.Serializer):
    pk = serializers.CharField()
    name = serializers.CharField(required=False)
    points = NeomodelPointField(required=False)

    def create(self, validated_data):
        latitude = validated_data.pop('latitude', None)
        longitude = validated_data.pop('longitude', None)
        location = LOCATION(**validated_data)
        if latitude is not None and longitude is not None:
            location.points = NeomodelPoint((latitude, longitude), crs='wgs-84')
         
        location.save()
        return location
    
    def update(self, instance, validated_data):
        latitude = validated_data.pop('points', None).latitude
        longitude = validated_data.pop('points', None).longitude
        instance.name = validated_data.get('name', instance.name)
        if latitude is not None and longitude is not None:
            instance.points = NeomodelPoint((latitude, longitude), crs='wgs-84')
          
        instance.save()
        return instance
    
    
