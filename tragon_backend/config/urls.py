"""
URL configuration for Tragón backend.
"""

from django.contrib import admin
from django.urls import include, path

api_v1_patterns = [
    # App URL includes will be added as APIs are built
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1_patterns)),
]
