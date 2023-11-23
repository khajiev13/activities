from django.urls import path
from .views import ColorListCreateView, ColorDetailView

urlpatterns = [
    path('', ColorListCreateView.as_view(), name='color-list'),
    path('<str:name>/', ColorDetailView.as_view(), name='color-detail'),
]
