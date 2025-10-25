"""ASGI config for Heyday backend."""
from __future__ import annotations

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "heyday_backend.settings")

application = get_asgi_application()
