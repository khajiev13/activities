from rest_framework import generics

from .models import COLOR
from .serializers import ColorSerializer
from neomodel import DoesNotExist
from django.http import Http404


class ColorListCreateView(generics.ListCreateAPIView):
    serializer_class = ColorSerializer
    def get_queryset(self):
        return COLOR.nodes.all()

class ColorDetailView(generics.RetrieveUpdateDestroyAPIView):
    lookup_field = 'name'
    queryset = COLOR.nodes
    serializer_class = ColorSerializer
    def get_object(self):
        try:
            obj = COLOR.nodes.get(name=self.kwargs[self.lookup_field])
        except DoesNotExist:
            raise Http404
        return obj