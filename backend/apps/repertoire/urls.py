from django.urls import path

from .views import (
    SetlistAddItemView,
    SetlistDetailView,
    SetlistItemDeleteView,
    SetlistListCreateView,
    SetlistReorderView,
    SongDetailView,
    SongListCreateView,
)

urlpatterns = [
    path("songs/", SongListCreateView.as_view(), name="song-list-create"),
    path("songs/<int:pk>/", SongDetailView.as_view(), name="song-detail"),
    path("setlists/", SetlistListCreateView.as_view(), name="setlist-list-create"),
    path("setlists/<int:pk>/", SetlistDetailView.as_view(), name="setlist-detail"),
    path("setlists/<int:setlist_id>/items/", SetlistAddItemView.as_view(), name="setlist-add-item"),
    path("setlists/<int:setlist_id>/reorder/", SetlistReorderView.as_view(), name="setlist-reorder"),
    path("items/<int:item_id>/", SetlistItemDeleteView.as_view(), name="setlist-item-delete"),
]
