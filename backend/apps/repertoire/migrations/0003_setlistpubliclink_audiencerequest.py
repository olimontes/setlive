import django.db.models.deletion
from django.db import migrations, models

import apps.repertoire.models


class Migration(migrations.Migration):
    dependencies = [
        ("repertoire", "0002_song_spotify_metadata"),
    ]

    operations = [
        migrations.CreateModel(
            name="SetlistPublicLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(db_index=True, default=apps.repertoire.models._generate_public_token, max_length=64, unique=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "setlist",
                    models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="public_link", to="repertoire.setlist"),
                ),
            ],
            options={
                "ordering": ["-updated_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="AudienceRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("requester_name", models.CharField(blank=True, max_length=80)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("session_key", models.CharField(blank=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "setlist",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="audience_requests", to="repertoire.setlist"),
                ),
                (
                    "song",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="audience_requests", to="repertoire.song"),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
    ]
