from django.urls import path
from teams.views import TeamListCreateView, TeamDetailView

urlpatterns = [
    path('', TeamListCreateView.as_view(), name='team-list-create'),
<<<<<<< HEAD
    path('<str:name>/', TeamDetailView.as_view(), name='team-detail'),
=======
    path('/<str:name>/', TeamDetailView.as_view(), name='team-detail'),
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
]