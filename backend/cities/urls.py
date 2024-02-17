from django.urls import path
from .views import ChooseCityView

urlpatterns = [
    path('choose-city/', ChooseCityView.as_view(), name='choose_city'),
]