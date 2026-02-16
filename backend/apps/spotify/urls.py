from django.urls import path

from .views import (
    SpotifyAuthUrlView,
    SpotifyConnectionStatusView,
    SpotifyExchangeCodeView,
    SpotifyImportPlaylistView,
    SpotifyPlaylistsView,
)

urlpatterns = [
    path("status/", SpotifyConnectionStatusView.as_view(), name="spotify-status"),
    path("auth-url/", SpotifyAuthUrlView.as_view(), name="spotify-auth-url"),
    path("exchange-code/", SpotifyExchangeCodeView.as_view(), name="spotify-exchange-code"),
    path("playlists/", SpotifyPlaylistsView.as_view(), name="spotify-playlists"),
    path("import-playlist/", SpotifyImportPlaylistView.as_view(), name="spotify-import-playlist"),
]
