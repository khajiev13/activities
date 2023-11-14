from django.urls import path
from teams.views import TeamListCreateView, TeamDetailView

urlpatterns = [
    path('', TeamListCreateView.as_view(), name='team-list-create'),
    path('/<str:name>/', TeamDetailView.as_view(), name='team-detail'),
]