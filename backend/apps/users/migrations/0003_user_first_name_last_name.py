from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_alter_user_options_alter_user_managers_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="first_name",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="user",
            name="last_name",
            field=models.CharField(blank=True, max_length=150),
        ),
    ]

