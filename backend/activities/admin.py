from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from activities.models import Activity

class ActivityAdmin(dj_admin.ModelAdmin):
    list_display = ("title", "description", "created_at", "duration", "public", "date_time")
neo_admin.register(Activity, ActivityAdmin)
