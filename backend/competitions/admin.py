from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from competitions.models import COMPETITION

class CompetitionAdmin(dj_admin.ModelAdmin):
    list_display = ('first_half_extra_time','second_half_extra_time')
neo_admin.register(COMPETITION, CompetitionAdmin)

