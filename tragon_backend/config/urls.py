"""
URL configuration for Tragón backend.
"""

from django.contrib import admin
from django.urls import include, path

api_v1_patterns = [
    path("auth/", include("apps.restaurants.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1_patterns)),
]
