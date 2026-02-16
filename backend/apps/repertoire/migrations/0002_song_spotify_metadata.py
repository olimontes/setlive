from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("repertoire", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="song",
            name="duration_ms",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="song",
            name="spotify_track_id",
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
    ]
