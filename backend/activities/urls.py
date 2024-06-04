from django.urls import path
from .views import ActivityListCreateView, ActivityDetailView, JoinActivityView, LeaveActivityView


urlpatterns = [
    path('', ActivityListCreateView.as_view()),
    # Join an activity
    path('<str:pk>/join/', JoinActivityView.as_view(), name='join-activity'),
    path('<str:pk>/leave/', LeaveActivityView.as_view(), name='leave-activity'),
    path('<str:pk>', ActivityDetailView.as_view(), name="activity-detail"),

    # Search activities by name
    path('search/<str:search>/', ActivityListCreateView.as_view(),
         name='activity-search'),
    # Get activities based on country
    path('country/<str:countries>/', ActivityListCreateView.as_view(),
         name='activity-list-by-country'),
    # Get activities based on state
    path('state/<str:states>/', ActivityListCreateView.as_view(),
         name='activity-list-by-state'),
    # Get activities based on city
    path('city/<str:cities>/', ActivityListCreateView.as_view(),
         name='activity-list-by-city'),
    # Get activities based on category
    path('category/<str:categories>/', ActivityListCreateView.as_view(),
         name='activity-list-by-category'),
    # Get activities that your friends joined
    path('friends/', ActivityListCreateView.as_view(),
         name='activity-list-by-friends'),
]
