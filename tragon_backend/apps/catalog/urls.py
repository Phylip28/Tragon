"""URL configuration for the catalog app."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    ProductViewSet,
    PublicMenuView,
    ToppingDetailViewSet,
    ToppingListCreateViewSet,
)

app_name = "catalog"

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"products", ProductViewSet, basename="product")
router.register(r"toppings", ToppingDetailViewSet, basename="topping")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "products/<uuid:product_id>/toppings/",
        ToppingListCreateViewSet.as_view({"get": "list", "post": "create"}),
        name="product-toppings",
    ),
    path(
        "<slug:slug>/menu/",
        PublicMenuView.as_view(),
        name="public-menu",
    ),
]
