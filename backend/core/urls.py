from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('api/activities/', include(('activities.urls', 'activities'), namespace='activities') ),
    path('api/colors/', include(('colors.urls', 'colors'), namespace='colors') ),
    path('api/teams/', include(('teams.urls', 'teams'), namespace='teams') ),
    path('api/users/',include(('users.urls','users'), namespace='users')),
    path('api/chatbot/', include(('chatbot.urls', 'chatbot'), namespace='chatbot') ),
    path('api/categories/', include(('categories.urls', 'categories'), namespace='categories') ),
    path('api/locations/', include(('locations.urls', 'locations'), namespace='locations') ),
    path('api/organizations/', include(('organizations.urls', 'organizations'), namespace='organizations') ),

]
