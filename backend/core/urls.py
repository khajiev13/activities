from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView


urlpatterns = [
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # Optional UI:
    path('api/schema/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),



    path('api/activities/', include(('activities.urls', 'activities'), namespace='activities') ),
    path('api/colors/', include(('colors.urls', 'colors'), namespace='colors') ),
    path('api/teams/', include(('teams.urls', 'teams'), namespace='teams') ),
    path('api/users/',include(('users.urls','users'), namespace='users')),
    path('api/chatbot/', include(('chatbot.urls', 'chatbot'), namespace='chatbot') ),
    path('api/categories/', include(('categories.urls', 'categories'), namespace='categories') ),
    path('api/locations/', include(('locations.urls', 'locations'), namespace='locations') ),
    path('api/organizations/', include(('organizations.urls', 'organizations'), namespace='organizations') ),

]
