from neomodel import db
from rest_framework import serializers
from .models import ACTIVITY  # Adjust the import based on your actual file structure

class ActivitySerializer(serializers.Serializer):
    pk = serializers.UUIDField(format='hex_verbose', read_only=True)
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(max_length=1000)
    duration_in_minutes = serializers.IntegerField()
    public = serializers.BooleanField()
    date_time = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S")
    