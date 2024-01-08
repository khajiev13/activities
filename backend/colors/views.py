from rest_framework import generics, permissions

from .models import COLOR
from .serializers import ColorSerializer
from neomodel import DoesNotExist
from django.http import Http404
from users.authentication import CustomJWTAuthentication


class ColorListCreateView(generics.ListCreateAPIView):
    serializer_class = ColorSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return COLOR.nodes.all()

class ColorDetailView(generics.RetrieveUpdateDestroyAPIView):
    lookup_field = 'name'
    queryset = COLOR.nodes
    serializer_class = ColorSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_object(self):
        try:
            obj = COLOR.nodes.get(name=self.kwargs[self.lookup_field])
        except DoesNotExist:
            raise Http404
        return obj

# {
#     "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTcwMDY3NjExMSwiaWF0IjoxNzAwNTg5NzExLCJqdGkiOiI3N2E0YTM0Mjk1ZGU0YWM2OTNlOGI5NThkODg2OGQ5NSIsInVzZXJuYW1lIjoianVzdGluIn0.dGVn6nihDyS-2aEryeeawNHS_6fB18mTnE1NvCg1rkk",
#     "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzAwNTkwMDExLCJpYXQiOjE3MDA1ODk3MTEsImp0aSI6IjYwZDUyYmU5NmZlYjQ2NWE5ZDA5ZDI2YjZhOWNhMTU0IiwidXNlcm5hbWUiOiJqdXN0aW4ifQ.oOfBJzQBzpLP-ZTxCdk2lbQKJ-hFd67wwgEarHE0ra8"
# }