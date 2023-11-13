from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from .models import LOCATION

class LocationAdmin(dj_admin.ModelAdmin):
    list_display = ("pk", "name", "points",)
neo_admin.register(LOCATION, LocationAdmin)
