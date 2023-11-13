from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from teams.models import TEAM

class TeamAdmin(dj_admin.ModelAdmin):
    list_display = ('name','men_team','founded_at')
neo_admin.register(TEAM, TeamAdmin)
