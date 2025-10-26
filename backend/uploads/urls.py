from django.urls import path
from . import views

urlpatterns = [
    path("", views.upload_photo, name="upload_photo"),
    path("classify/", views.classify_plant, name="classify_plant"),
    path("add/", views.add_plant, name="add_plant"),
]