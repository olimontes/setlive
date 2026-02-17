from rest_framework import serializers

from .models import AudienceRequest, Setlist, SetlistItem, SetlistPublicLink, Song


class SongSerializer(serializers.ModelSerializer):
    class Meta:
        model = Song
        fields = ("id", "title", "artist", "chord_url", "duration_ms", "spotify_track_id", "created_at")
        read_only_fields = ("id", "spotify_track_id", "created_at")


class SetlistItemSerializer(serializers.ModelSerializer):
    song = SongSerializer(read_only=True)

    class Meta:
        model = SetlistItem
        fields = ("id", "position", "song")


class SetlistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Setlist
        fields = ("id", "name", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class SetlistDetailSerializer(serializers.ModelSerializer):
    items = SetlistItemSerializer(many=True, read_only=True)

    class Meta:
        model = Setlist
        fields = ("id", "name", "created_at", "updated_at", "items")
        read_only_fields = ("id", "created_at", "updated_at", "items")


class AddSetlistItemSerializer(serializers.Serializer):
    song_id = serializers.IntegerField(min_value=1)


class ReorderSetlistSerializer(serializers.Serializer):
    item_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )


class SetlistPublicLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = SetlistPublicLink
        fields = ("token", "is_active", "created_at", "updated_at")
        read_only_fields = ("token", "created_at", "updated_at")


class AudienceRequestSerializer(serializers.ModelSerializer):
    song = SongSerializer(read_only=True)
    requested_song_name = serializers.CharField(read_only=True)

    class Meta:
        model = AudienceRequest
        fields = ("id", "requester_name", "requested_song_name", "song", "created_at")
        read_only_fields = ("id", "requested_song_name", "song", "created_at")


class PublicSetlistSongSerializer(serializers.ModelSerializer):
    class Meta:
        model = Song
        fields = ("id", "title", "artist")


class PublicSetlistItemSerializer(serializers.ModelSerializer):
    song = PublicSetlistSongSerializer(read_only=True)

    class Meta:
        model = SetlistItem
        fields = ("id", "position", "song")


class PublicSetlistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Setlist
        fields = ("id", "name")
        read_only_fields = ("id", "name")


class PublicAudienceRequestCreateSerializer(serializers.Serializer):
    song_name = serializers.CharField(max_length=255)
    requester_name = serializers.CharField(max_length=80, required=False, allow_blank=True)
