from .views import OrganizationListCreate, OrganizationDetail, ListOrganizations
from django.urls import path



urlpatterns = [
    path('', OrganizationListCreate.as_view(), name='organzation-list-create'),
    path('list/', ListOrganizations.as_view()),
    path('<str:pk>/', OrganizationDetail.as_view(), name='organzation-detail'),
]