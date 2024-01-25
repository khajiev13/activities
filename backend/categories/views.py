from django.shortcuts import render
from categories.models import CATEGORY
from rest_framework.permissions import AllowAny
from .serializers import CategorySerializer
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from users.serializers import UserSerializer
from activities.serializers import ActivitySerializer
from teams.serializers import TeamSerializer
# Create your views here.

from rest_framework import viewsets



class CategoryList(viewsets.ViewSet):
    permission_classes = [AllowAny]
    queryset = CATEGORY.nodes.all()

    def list(self, request):
        serializer = CategorySerializer(self.queryset, many=True)
        return Response(serializer.data)
    
    def retrieve(self, request, pk=None):
        category = get_object_or_404(CATEGORY.nodes, pk=pk)
        serializer = CategorySerializer(category)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        category = get_object_or_404(CATEGORY.nodes, pk=pk)
        serializer = UserSerializer(category.users.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def activities(self, request, pk=None):
        category = get_object_or_404(CATEGORY.nodes, pk=pk)
        serializer = ActivitySerializer(category.activities.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def teams(self, request, pk=None):
        category = get_object_or_404(CATEGORY.nodes, pk=pk)
        serializer = TeamSerializer(category.teams.all(), many=True)
        return Response(serializer.data)