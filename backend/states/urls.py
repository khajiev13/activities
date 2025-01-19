from django.urls import path
from states.views import ListStates


urlpatterns = [
    # Add your URL patterns here
    path('list/', ListStates.as_view()),
]
