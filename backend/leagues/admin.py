from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from .models import LEAGUE

class LeagueAdmin(dj_admin.ModelAdmin):
    list_display = ("name", "description",)
neo_admin.register(LEAGUE, LeagueAdmin)
