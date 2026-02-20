import os

from django.core.wsgi import get_wsgi_application


if not os.getenv("DJANGO_SETTINGS_MODULE"):
    raise RuntimeError("DJANGO_SETTINGS_MODULE must be set explicitly.")

application = get_wsgi_application()
