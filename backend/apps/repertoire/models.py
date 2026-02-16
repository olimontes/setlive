from django.conf import settings
from django.db import models


class Song(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="songs")
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    spotify_track_id = models.CharField(max_length=64, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title", "id"]

    def __str__(self):
        return f"{self.title} - {self.artist}" if self.artist else self.title


class Setlist(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="setlists")
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return self.name


class SetlistItem(models.Model):
    setlist = models.ForeignKey(Setlist, on_delete=models.CASCADE, related_name="items")
    song = models.ForeignKey(Song, on_delete=models.CASCADE, related_name="setlist_items")
    position = models.PositiveIntegerField()

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(fields=["setlist", "position"], name="uniq_setlist_position"),
        ]

    def __str__(self):
        return f"{self.setlist.name} #{self.position} - {self.song.title}"
