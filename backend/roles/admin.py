from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from .models import ROLE

class RolesAdmin(dj_admin.ModelAdmin):
    list_display = ("pk", "name")
neo_admin.register(ROLE, RolesAdmin)