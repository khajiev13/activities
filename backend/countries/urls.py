from .views import CountryList
from django.urls import path

urlpatterns = [
    path('list/', CountryList.as_view(), name='country-list'),
]