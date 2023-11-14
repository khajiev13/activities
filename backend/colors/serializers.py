from rest_framework import serializers
from .models import COLOR
from rest_framework import serializers
from .models import COLOR

class ColorSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    def create(self, validated_data):
        return COLOR(**validated_data).save()

    def update(self, instance, validated_data):
        instance.name = validated_data.get('name', instance.name)
        instance.save()
        return instance
    class Meta:
        model = COLOR
        fields = ('__all__')