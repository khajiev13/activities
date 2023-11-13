from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from .models import ORGANIZATION

class OrganizationsAdmin(dj_admin.ModelAdmin):
    list_display = ("pk", "name",)
neo_admin.register(ORGANIZATION, OrganizationsAdmin)
