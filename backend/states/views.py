from django.shortcuts import render
from rest_framework import generics
from states.serializers import StateSerializer
from rest_framework.permissions import IsAuthenticated
from states.models import STATE
# Create your views here.


class ListStates(generics.ListCreateAPIView):
    queryset = STATE.nodes.all()
    serializer_class = StateSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'name'

    