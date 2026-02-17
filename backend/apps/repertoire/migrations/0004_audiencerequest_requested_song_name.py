import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("repertoire", "0003_setlistpubliclink_audiencerequest"),
    ]

    operations = [
        migrations.AlterField(
            model_name="audiencerequest",
            name="song",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="audience_requests",
                to="repertoire.song",
            ),
        ),
        migrations.AddField(
            model_name="audiencerequest",
            name="requested_song_name",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
