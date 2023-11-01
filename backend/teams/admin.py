from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from teams.models import Team

class GraphAdmin(dj_admin.ModelAdmin):
    list_display = ('name', 'description', 'founded_at', 'jersey_colors')
neo_admin.register(Team, GraphAdmin)
