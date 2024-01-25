from rest_framework import serializers
from neomodel.contrib.spatial_properties import NeomodelPoint
from .models import LOCATION

class LocationSerializer(serializers.Serializer):
    pk = serializers.CharField(read_only=True)
    name = serializers.CharField()
    latitude = serializers.FloatField(write_only=True, required=False)
    longitude = serializers.FloatField(write_only=True, required=False)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.points:
            representation['points'] = {
                'latitude': instance.points.latitude,
                'longitude': instance.points.longitude
                # Include 'height' if you are using 3D points
            }
        return representation
    
    def validate(self, data):
        if data['latitude'] is None or data['longitude'] is None or data['latitude'] == '' or data['longitude'] == '' or data['name'] is None or data['name'] == '':
            raise serializers.ValidationError("Name, latitude and longitude are required")
        return data

    def create(self, validated_data):
        latitude = validated_data.pop('latitude', None)
        longitude = validated_data.pop('longitude', None)
        location = LOCATION(**validated_data)
        if latitude is not None and longitude is not None:
            location.points = NeomodelPoint((latitude, longitude), crs='wgs-84')
            # Add 'height' if using 3D points
        location.save()
        return location
    
    def update(self, instance, validated_data):
        latitude = validated_data.pop('points', None).latitude
        longitude = validated_data.pop('points', None).longitude
        instance.name = validated_data.get('name', instance.name)
        if latitude is not None and longitude is not None:
            instance.points = NeomodelPoint((latitude, longitude), crs='wgs-84')
            # Add 'height' if using 3D points
        instance.save()
        return instance
    
    
