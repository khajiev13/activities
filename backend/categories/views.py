from categories.models import CATEGORY
from rest_framework.permissions import AllowAny
from .serializers import CategorySerializer
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from users.serializers import UserSerializer
from activities.serializers import ActivitySerializer
from teams.serializers import TeamListSerializer
# Create your views here.

from rest_framework import viewsets



class CategoryList(viewsets.ViewSet):
    permission_classes = [AllowAny]
    queryset = CATEGORY.nodes.all()

    def get_queryset(self):
        return CATEGORY.nodes.all()

    def list(self, request):
        def str_to_bool(s):
            if s == 'True' or s == 'true':
                return True
            elif s == 'False' or s == 'false':
                return False
            else:
                raise ValueError("Cannot convert {} to a bool".format(s))
        is_indoor = request.query_params.get('is_indoor', None)
        is_outdoor = request.query_params.get('is_outdoor', None)
        is_online = request.query_params.get('is_online', None)
        
        if is_indoor is not None and is_online is not None and is_outdoor is not None:
            queryset = CATEGORY.nodes.filter(is_indoor=str_to_bool(is_indoor), is_online=str_to_bool(is_online), is_outdoor=str_to_bool(is_outdoor))
            return Response(CategorySerializer(queryset, many=True).data)
        serializer = CategorySerializer(self.get_queryset(), many=True)
        return Response(serializer.data)
    
    def retrieve(self, request, pk=None):
        category = get_object_or_404(CATEGORY.nodes, pk=pk)
        serializer = CategorySerializer(category)
        return Response(serializer.data)
    
    def create(self, request):
        serializer = CategorySerializer(data=request.data)
        if serializer.is_valid():
            category = serializer.save()
            print(category)  # Add this line
            return Response(CategorySerializer(category).data)
        return Response(serializer.errors, status=400)
    
    def destroy(self, request, pk=None):
        category = get_object_or_404(CATEGORY.nodes, pk=pk)
        category.delete()
        return Response({'message': 'Category deleted successfully'}, status=204)

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
        serializer = TeamListSerializer(category.teams.all(), many=True)
        return Response(serializer.data)