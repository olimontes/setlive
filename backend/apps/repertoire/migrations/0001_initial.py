from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("users", "0003_user_first_name_last_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="Song",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("artist", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="songs", to="users.user"),
                ),
            ],
            options={"ordering": ["title", "id"]},
        ),
        migrations.CreateModel(
            name="Setlist",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="setlists", to="users.user"),
                ),
            ],
            options={"ordering": ["-updated_at", "-id"]},
        ),
        migrations.CreateModel(
            name="SetlistItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("position", models.PositiveIntegerField()),
                (
                    "setlist",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="repertoire.setlist"),
                ),
                (
                    "song",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="setlist_items", to="repertoire.song"),
                ),
            ],
            options={"ordering": ["position", "id"]},
        ),
        migrations.AddConstraint(
            model_name="setlistitem",
            constraint=models.UniqueConstraint(fields=("setlist", "position"), name="uniq_setlist_position"),
        ),
    ]
