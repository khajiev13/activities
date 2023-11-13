from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from countries.models import COUNTRY

class CountryAdmin(dj_admin.ModelAdmin):
    list_display = ("name","cities")
neo_admin.register(COUNTRY, CountryAdmin)
