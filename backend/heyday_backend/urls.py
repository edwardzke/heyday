"""Root URL configuration for the Heyday backend."""
from django.contrib import admin
from django.urls import include, path

from apps.core import views as core_views

urlpatterns = [
    path("", core_views.landing_page, name="landing-page"),
    path("dashboard/", core_views.dashboard_page, name="dashboard-page"),
    path("admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
]
