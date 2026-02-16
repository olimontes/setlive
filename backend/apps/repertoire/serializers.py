from rest_framework import serializers

from .models import Setlist, SetlistItem, Song


class SongSerializer(serializers.ModelSerializer):
    class Meta:
        model = Song
        fields = ("id", "title", "artist", "created_at")
        read_only_fields = ("id", "created_at")


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
