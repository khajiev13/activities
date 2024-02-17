from .views import OrganizationListCreate, OrganizationDetail
from django.urls import path


urlpatterns = [
    path('', OrganizationListCreate.as_view(), name='organzation-list-create'),
    path('<str:pk>/', OrganizationDetail.as_view(), name='organzation-detail'),
]