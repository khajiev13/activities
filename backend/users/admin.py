from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from users.models import User

class UserAdmin(dj_admin.ModelAdmin):
    list_display = ('uid','first_name','last_name', 'age', 'friends', 'gender','role','points','created_at','email')
neo_admin.register(User, UserAdmin)
