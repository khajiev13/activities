from django.urls import path
from .views import UserListCreateView, UserDetailView
urlpatterns = [
    path('', UserListCreateView.as_view(), name='user_list_create'),
    path('<str:username>/', UserDetailView.as_view(), name='user_detail'),

]