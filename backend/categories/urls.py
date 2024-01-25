from .views import CategoryList
from rest_framework.routers import DefaultRouter

app_name = 'categories'

router = DefaultRouter()
router.register('', CategoryList, basename='categories')
urlpatterns = router.urls
