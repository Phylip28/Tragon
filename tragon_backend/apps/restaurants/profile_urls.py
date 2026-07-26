"""URL configuration for restaurant profile and payment methods."""

from django.urls import path

from .views import (
    PaymentMethodDetailView,
    PaymentMethodListCreateView,
    RestaurantProfileView,
    RestaurantUploadLogoView,
)

app_name = "restaurants"

urlpatterns = [
    path("me/", RestaurantProfileView.as_view(), name="profile"),
    path("me/upload-logo/", RestaurantUploadLogoView.as_view(), name="upload-logo"),
    path(
        "me/payment-methods/",
        PaymentMethodListCreateView.as_view(),
        name="payment-methods-list",
    ),
    path(
        "me/payment-methods/<uuid:pk>/",
        PaymentMethodDetailView.as_view(),
        name="payment-methods-detail",
    ),
]
