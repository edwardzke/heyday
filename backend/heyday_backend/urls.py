"""Root URL configuration for the Heyday backend."""
from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static

from apps.core import views as core_views

urlpatterns = [
    path("", core_views.landing_page, name="landing-page"),
    path("dashboard/", core_views.dashboard_page, name="dashboard-page"),
    path("admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("upload/", include("uploads.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)