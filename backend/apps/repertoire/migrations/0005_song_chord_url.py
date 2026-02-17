from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("repertoire", "0004_audiencerequest_requested_song_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="song",
            name="chord_url",
            field=models.URLField(blank=True),
        ),
    ]
