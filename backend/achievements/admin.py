from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from .models import ACHIEVEMENT

class AchievementsAdmin(dj_admin.ModelAdmin):
    list_display = ("name","description")
neo_admin.register(ACHIEVEMENT, AchievementsAdmin)
