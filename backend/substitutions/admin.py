from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from .models import SUBSTITUTION

class SubstitutionAdmin(dj_admin.ModelAdmin):
    list_display = ("pk", "date")
neo_admin.register(SUBSTITUTION, SubstitutionAdmin)