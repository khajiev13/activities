from django.urls import path
<<<<<<< HEAD
from .views import ActivityListCreateView

urlpatterns = [
    path('', ActivityListCreateView.as_view(),name='activity-list'),
=======
from . import views

urlpatterns = [
    # path('', views.ActivityList.as_view()),name='activity-list'),
>>>>>>> 187324eb0eb9ab7fb5d148fc56a646f83bd65010
]