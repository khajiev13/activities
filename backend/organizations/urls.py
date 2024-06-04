from .views import OrganizationListCreate, OrganizationDetail, ListOrganizations
from django.urls import path


urlpatterns = [
    path('', OrganizationListCreate.as_view(), name='organzation-list-create'),
    path('list/', ListOrganizations.as_view()),
    path('<str:pk>/', OrganizationDetail.as_view(), name='organzation-detail'),
    # Get teams based on country
    path('country/<str:countries>/', OrganizationListCreate.as_view(),
         name='organization-list-by-country'),
    path('state/<str:states>/', OrganizationListCreate.as_view(),
         name="organization-list-by-state"),
    path('city/<str:cities>/', OrganizationListCreate.as_view(),
         name="organization-list-by-city"),
]
