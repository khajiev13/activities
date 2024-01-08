from rest_framework import generics, permissions

from .models import COLOR
from .serializers import ColorSerializer
from neomodel import DoesNotExist
from django.http import Http404
from users.authentication import CustomJWTAuthentication
<<<<<<< HEAD
from rest_framework.response import Response
from rest_framework import status
from neomodel.exceptions import UniqueProperty
=======
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010


class ColorListCreateView(generics.ListCreateAPIView):
    serializer_class = ColorSerializer
<<<<<<< HEAD
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    def get_queryset(self):
        return COLOR.nodes.all()
    def create(self, request, *args, **kwargs):
        try:
            data = request.data.copy()  # Copy the QueryDict to a mutable dictionary
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response({"message": "Success"}, status=status.HTTP_201_CREATED, headers=headers)
        except UniqueProperty as e:
            return Response({"message": str(e)}, status=status.HTTP_409_CONFLICT)
    
    
=======
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return COLOR.nodes.all()

>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
class ColorDetailView(generics.RetrieveUpdateDestroyAPIView):
    lookup_field = 'name'
    queryset = COLOR.nodes
    serializer_class = ColorSerializer
<<<<<<< HEAD
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return super().get_queryset().filter(name=self.kwargs[self.lookup_field])
=======
    permission_classes = [permissions.IsAuthenticated]
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
    def get_object(self):
        try:
            obj = COLOR.nodes.get(name=self.kwargs[self.lookup_field])
        except DoesNotExist:
            raise Http404
        return obj
<<<<<<< HEAD
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response({"message": "Success"}, status=status.HTTP_200_OK)
        except Http404:
            return Response({"message": "Not Found"}, status=status.HTTP_404_NOT_FOUND)
    def perform_destroy(self, instance):
        instance.delete()
    
=======

# {
#     "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTcwMDY3NjExMSwiaWF0IjoxNzAwNTg5NzExLCJqdGkiOiI3N2E0YTM0Mjk1ZGU0YWM2OTNlOGI5NThkODg2OGQ5NSIsInVzZXJuYW1lIjoianVzdGluIn0.dGVn6nihDyS-2aEryeeawNHS_6fB18mTnE1NvCg1rkk",
#     "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzAwNTkwMDExLCJpYXQiOjE3MDA1ODk3MTEsImp0aSI6IjYwZDUyYmU5NmZlYjQ2NWE5ZDA5ZDI2YjZhOWNhMTU0IiwidXNlcm5hbWUiOiJqdXN0aW4ifQ.oOfBJzQBzpLP-ZTxCdk2lbQKJ-hFd67wwgEarHE0ra8"
# }
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
