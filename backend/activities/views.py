<<<<<<< HEAD
from rest_framework import generics
from activities.serializers import ActivitySerializer
from rest_framework.permissions import AllowAny
from activities.models import ACTIVITY


class ActivityListCreateView(generics.ListCreateAPIView):
    #I have to return 
    # title: string;
    # description: string;
    # isPublic: boolean;
    # participantsCount: number;
    # creatorName: string;
    # categories: string[];
    # dateTime: string;
    # city: string;
    # duration: string;
    queryset = ACTIVITY.nodes.all()
    serializer_class = ActivitySerializer
    permission_classes = [AllowAny]
    
=======
from django.shortcuts import render

# Create your views here.
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
