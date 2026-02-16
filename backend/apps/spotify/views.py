import base64
import os
import secrets
from datetime import timedelta

import requests
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.repertoire.models import Setlist, SetlistItem, Song
from apps.spotify.models import SpotifyConnection

SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"
SPOTIFY_SCOPES = "playlist-read-private playlist-read-collaborative"


class PlaylistImportSerializer(serializers.Serializer):
    playlist_id = serializers.CharField(max_length=128)


def _spotify_client_credentials():
    client_id = os.getenv("SPOTIFY_CLIENT_ID", "")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise serializers.ValidationError("Spotify nao configurado no servidor.")
    return client_id, client_secret


def _default_redirect_uri():
    return os.getenv("SPOTIFY_REDIRECT_URI", "http://localhost:5173")


def _auth_headers(access_token):
    return {"Authorization": f"Bearer {access_token}"}


def _token_request(data):
    client_id, client_secret = _spotify_client_credentials()
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("utf-8")
    headers = {
        "Authorization": f"Basic {basic}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    response = requests.post(SPOTIFY_TOKEN_URL, data=data, headers=headers, timeout=15)
    if response.status_code >= 400:
        detail = "Falha ao autenticar com Spotify."
        try:
            payload = response.json()
            detail = payload.get("error_description") or payload.get("error") or detail
        except Exception:
            pass
        raise serializers.ValidationError(detail)
    return response.json()


def _save_tokens(connection, token_payload):
    expires_in = int(token_payload.get("expires_in", 3600))
    connection.access_token = token_payload.get("access_token", connection.access_token)
    if token_payload.get("refresh_token"):
        connection.refresh_token = token_payload["refresh_token"]
    connection.token_expires_at = timezone.now() + timedelta(seconds=expires_in)
    connection.save(update_fields=["access_token", "refresh_token", "token_expires_at", "updated_at"])


def _ensure_access_token(connection):
    if connection.access_token and connection.token_expires_at and connection.token_expires_at > timezone.now() + timedelta(seconds=30):
        return connection.access_token

    if not connection.refresh_token:
        raise serializers.ValidationError("Conexao Spotify expirada. Conecte novamente.")

    token_payload = _token_request(
        {
            "grant_type": "refresh_token",
            "refresh_token": connection.refresh_token,
        }
    )
    _save_tokens(connection, token_payload)
    return connection.access_token


def _fetch_spotify_profile(access_token):
    response = requests.get(f"{SPOTIFY_API_BASE}/me", headers=_auth_headers(access_token), timeout=15)
    if response.status_code >= 400:
        raise serializers.ValidationError("Falha ao obter perfil Spotify.")
    return response.json()


def _fetch_playlists(access_token):
    playlists = []
    url = f"{SPOTIFY_API_BASE}/me/playlists?limit=50"

    while url:
        response = requests.get(url, headers=_auth_headers(access_token), timeout=20)
        if response.status_code >= 400:
            raise serializers.ValidationError("Falha ao listar playlists no Spotify.")

        payload = response.json()
        for item in payload.get("items", []):
            playlists.append(
                {
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "tracks_total": item.get("tracks", {}).get("total", 0),
                }
            )

        url = payload.get("next")

    return playlists


def _fetch_playlist_tracks(access_token, playlist_id):
    response = requests.get(
        f"{SPOTIFY_API_BASE}/playlists/{playlist_id}?fields=id,name",
        headers=_auth_headers(access_token),
        timeout=20,
    )
    if response.status_code >= 400:
        raise serializers.ValidationError("Playlist nao encontrada no Spotify.")

    playlist_payload = response.json()
    playlist_name = playlist_payload.get("name") or "Playlist importada"

    tracks = []
    url = f"{SPOTIFY_API_BASE}/playlists/{playlist_id}/tracks?limit=100"
    while url:
        track_response = requests.get(url, headers=_auth_headers(access_token), timeout=20)
        if track_response.status_code >= 400:
            raise serializers.ValidationError("Falha ao buscar faixas da playlist.")

        payload = track_response.json()
        for item in payload.get("items", []):
            track = item.get("track") or {}
            if not track or track.get("is_local"):
                continue

            title = (track.get("name") or "").strip()
            if not title:
                continue

            artists = track.get("artists") or []
            artist_name = ", ".join([artist.get("name", "").strip() for artist in artists if artist.get("name")]).strip()
            tracks.append(
                {
                    "spotify_track_id": track.get("id") or "",
                    "title": title,
                    "artist": artist_name,
                    "duration_ms": track.get("duration_ms"),
                }
            )

        url = payload.get("next")

    return playlist_name, tracks


class SpotifyAuthUrlView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        client_id, _ = _spotify_client_credentials()
        redirect_uri = request.query_params.get("redirect_uri") or _default_redirect_uri()

        connection, _ = SpotifyConnection.objects.get_or_create(user=request.user)
        state = secrets.token_urlsafe(24)
        connection.oauth_state = state
        connection.save(update_fields=["oauth_state", "updated_at"])

        params = {
            "client_id": client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": SPOTIFY_SCOPES,
            "state": state,
        }

        query = "&".join([f"{key}={requests.utils.quote(value)}" for key, value in params.items()])
        return Response({"authorize_url": f"{SPOTIFY_AUTHORIZE_URL}?{query}"})


class SpotifyExchangeCodeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = request.data.get("code", "")
        state = request.data.get("state", "")
        redirect_uri = request.data.get("redirect_uri") or _default_redirect_uri()

        if not code or not state:
            return Response({"detail": "Codigo e state sao obrigatorios."}, status=status.HTTP_400_BAD_REQUEST)

        connection, _ = SpotifyConnection.objects.get_or_create(user=request.user)

        if not connection.oauth_state or connection.oauth_state != state:
            return Response({"detail": "State OAuth invalido."}, status=status.HTTP_400_BAD_REQUEST)

        token_payload = _token_request(
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            }
        )
        _save_tokens(connection, token_payload)

        profile = _fetch_spotify_profile(connection.access_token)
        connection.spotify_user_id = profile.get("id", "")
        connection.display_name = profile.get("display_name") or profile.get("id", "")
        connection.oauth_state = ""
        connection.save(update_fields=["spotify_user_id", "display_name", "oauth_state", "updated_at"])

        return Response(
            {
                "connected": True,
                "spotify_user_id": connection.spotify_user_id,
                "display_name": connection.display_name,
            }
        )


class SpotifyConnectionStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        connection = SpotifyConnection.objects.filter(user=request.user).first()
        if not connection or not connection.refresh_token:
            return Response({"connected": False})

        return Response(
            {
                "connected": True,
                "spotify_user_id": connection.spotify_user_id,
                "display_name": connection.display_name,
            }
        )


class SpotifyPlaylistsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        connection = SpotifyConnection.objects.filter(user=request.user).first()
        if not connection:
            return Response({"detail": "Conta Spotify nao conectada."}, status=status.HTTP_400_BAD_REQUEST)

        access_token = _ensure_access_token(connection)
        playlists = _fetch_playlists(access_token)
        return Response({"items": playlists})


class SpotifyImportPlaylistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PlaylistImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        playlist_id = serializer.validated_data["playlist_id"]

        connection = SpotifyConnection.objects.filter(user=request.user).first()
        if not connection:
            return Response({"detail": "Conta Spotify nao conectada."}, status=status.HTTP_400_BAD_REQUEST)

        access_token = _ensure_access_token(connection)
        playlist_name, tracks = _fetch_playlist_tracks(access_token, playlist_id)

        with transaction.atomic():
            setlist = Setlist.objects.create(user=request.user, name=playlist_name)

            position = 1
            imported_count = 0
            reused_count = 0

            for track in tracks:
                spotify_track_id = track.get("spotify_track_id", "")
                title = track.get("title", "")
                artist = track.get("artist", "")
                duration_ms = track.get("duration_ms")

                song = None
                if spotify_track_id:
                    song = Song.objects.filter(user=request.user, spotify_track_id=spotify_track_id).first()

                if not song:
                    song = Song.objects.filter(user=request.user, title__iexact=title, artist__iexact=artist).first()

                if song:
                    reused_count += 1
                    updated_fields = []
                    if spotify_track_id and not song.spotify_track_id:
                        song.spotify_track_id = spotify_track_id
                        updated_fields.append("spotify_track_id")
                    if duration_ms and not song.duration_ms:
                        song.duration_ms = duration_ms
                        updated_fields.append("duration_ms")
                    if updated_fields:
                        song.save(update_fields=updated_fields)
                else:
                    song = Song.objects.create(
                        user=request.user,
                        title=title,
                        artist=artist,
                        duration_ms=duration_ms,
                        spotify_track_id=spotify_track_id,
                    )
                    imported_count += 1

                SetlistItem.objects.create(setlist=setlist, song=song, position=position)
                position += 1

        return Response(
            {
                "setlist_id": setlist.id,
                "setlist_name": setlist.name,
                "tracks_total": len(tracks),
                "songs_created": imported_count,
                "songs_reused": reused_count,
            },
            status=status.HTTP_201_CREATED,
        )
