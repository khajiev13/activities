from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from users.serializers import CustomTokenObtainPairView
urlpatterns = [
    path('api/activities/', include(('activities.urls', 'activities'), namespace='activities') ),
    path('api/colors/', include(('colors.urls', 'colors'), namespace='colors') ),
    path('api/teams/', include(('teams.urls', 'teams'), namespace='teams') ),
    path('api/users/',include(('users.urls','users'), namespace='users')),
    path('api/token/',CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/',TokenRefreshView.as_view(), name='token_refresh'),
]
