from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('api/activities/', include(('activities.urls', 'activities'), namespace='activities') ),
    path('api/colors/', include(('colors.urls', 'colors'), namespace='colors') ),
    path('api/teams/', include(('teams.urls', 'teams'), namespace='teams') ),
    path('api/users/',include(('users.urls','users'), namespace='users')),

]
