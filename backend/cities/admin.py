from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from .models import CITY

class CitiesAdmin(dj_admin.ModelAdmin):
    list_display = ("pk", "name",)
neo_admin.register(CITY, CitiesAdmin)
