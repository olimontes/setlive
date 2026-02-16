from django.contrib import admin

from .models import Setlist, SetlistItem, Song


admin.site.register(Song)
admin.site.register(Setlist)
admin.site.register(SetlistItem)
