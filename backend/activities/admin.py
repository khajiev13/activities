from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from activities.models import ACTIVITY

class ActivitiesAdmin(dj_admin.ModelAdmin):
    list_display = ("title","description")
neo_admin.register(ACTIVITY, ActivitiesAdmin)
