from django.contrib import admin
from django.urls import include, path

from config.views import HealthcheckView

urlpatterns = [
    path('healthz/', HealthcheckView.as_view(), name='healthz'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/repertoire/', include('apps.repertoire.urls')),
    path('api/spotify/', include('apps.spotify.urls')),
]
