from django.db import models
from django.contrib.auth.models import User

class Plant(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="plants", null=True, blank=True)
    species = models.CharField(max_length=255)
    nickname = models.CharField(max_length=255, blank=True)
    age = models.CharField(max_length=100, blank=True)
    photo_url = models.URLField(blank=True, null=True)
    date_added = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nickname or self.species
