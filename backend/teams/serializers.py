from rest_framework import serializers
from teams.models import TEAM

class TeamListSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    men_team = serializers.BooleanField()
    founded_at = serializers.DateTimeField()
    category = serializers.SerializerMethodField('get_category') 
    
    def get_category(self, obj):
        return [category for category in obj.category]
    
    def create(self, validated_data):
        return TEAM(**validated_data).save()

    def update(self, instance, validated_data):
        instance.name = validated_data.get('name', instance.name)
        # Update other fields as needed
        instance.save()
        return instance
    

class TeamDetailSerializer(TeamListSerializer):
    def get_tshirt_color(self, obj):
        return [color.name for color in obj.tshirt_color]

    def get_shorts_color(self, obj):
        return [color.name for color in obj.shorts_color]

    def get_socks_color(self, obj):
        return [color.name for color in obj.socks_color]
    def get_members(self, obj):
        return [{
            'properties':  {k: v for k, v in member.__properties__.items() if k not in ['password']},
            'team_details': obj.members.relationship(member).__properties__
        } for member in obj.members.all()]
    
    tshirt_color = serializers.SerializerMethodField('get_tshirt_color')
    shorts_color = serializers.SerializerMethodField('get_shorts_color')
    socks_color = serializers.SerializerMethodField('get_socks_color')
    members = serializers.SerializerMethodField('get_members')

    
