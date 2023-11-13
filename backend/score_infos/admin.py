from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from .models import SCORE_INFO

class ScoreInfoAdmin(dj_admin.ModelAdmin):
    list_display = ("pk", "time")
neo_admin.register(SCORE_INFO, ScoreInfoAdmin)