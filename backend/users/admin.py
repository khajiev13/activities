from django_neomodel import admin as neo_admin
from django.contrib import admin as dj_admin
from users.models import USER

class UserAdmin(dj_admin.ModelAdmin):
    list_display = ('first_name', 'gender', 'display_hobbies')

    def display_hobbies(self, obj):
        return ", ".join([str(hobby.name) for hobby in obj.hobbies.all()])
    display_hobbies.short_description = 'Hobbies'
neo_admin.register(USER, UserAdmin)