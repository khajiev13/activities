from django.urls import path
from . import views


urlpatterns = [
    path('', views.ActivityListCreateView.as_view()),
    path('<str:pk>', views.ActivityDetailView.as_view()),
]