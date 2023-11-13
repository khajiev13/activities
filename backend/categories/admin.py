from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from .models import CATEGORY

class CategoriesAdmin(dj_admin.ModelAdmin):
    list_display = ("pk", "name", "is_outdoor",)
neo_admin.register(CATEGORY, CategoriesAdmin)
