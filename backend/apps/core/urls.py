"""URL routes for the core API."""
from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health_check, name="health-check"),
    path("hello/", views.hello, name="hello"),
]
