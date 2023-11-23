from django.urls import path
from .views import UserListCreateView, UserDetailView
from rest_framework_simplejwt.views import TokenRefreshView
from users.serializers import CustomTokenObtainPairView
from users.views import BlacklistTokenView
urlpatterns = [
    path('', UserListCreateView.as_view(), name='user_list_create'),
    path('<str:username>/', UserDetailView.as_view(), name='user_detail'),
    path('token/get/',CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/',TokenRefreshView.as_view(), name='token_refresh'),
    path('token/logout-blacklist/',BlacklistTokenView.as_view(), name='token_blacklist'),

]