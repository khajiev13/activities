from django.urls import path
from teams.views import TeamListCreateView, TeamDetailView, JoinLeaveTeamView

urlpatterns = [
    path('', TeamListCreateView.as_view(), name='team-list-create'),
    # Join a team

    path('<str:team_name>/join/',
         JoinLeaveTeamView.as_view(), name='team-join'),
    path('<str:name>/', TeamDetailView.as_view(), name='team-detail'),
    # Search teams by name
    path('search/<str:search>/', TeamListCreateView.as_view(), name='team-search'),
    # Get teams based on country
    path('country/<str:countries>/', TeamListCreateView.as_view(),
         name='team-list-by-country'),
    path('state/<str:states>/', TeamListCreateView.as_view(),
         name="team-list-by-state"),
    path('city/<str:cities>/', TeamListCreateView.as_view(),
         name="team-list-by-city"),


]
