from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from .models import REQUEST

class RequestsAdmin(dj_admin.ModelAdmin):
    list_display = ("pk", "time", "accepted", "pending")
neo_admin.register(REQUEST, RequestsAdmin)
