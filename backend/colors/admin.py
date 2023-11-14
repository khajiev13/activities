from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from colors.models import COLOR

class ColorAdmin(dj_admin.ModelAdmin):
    list_display = ("name",)
neo_admin.register(COLOR, ColorAdmin)


















