"""Views for the orders app (read-only)."""

from rest_framework.mixins import ListModelMixin, RetrieveModelMixin
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from apps.orders.models import Order
from apps.orders.serializers import OrderDetailSerializer, OrderListSerializer
from apps.restaurants.mixins import RestaurantScopedMixin
from apps.restaurants.permissions import IsRestaurantOwner


class OrderViewSet(
    RestaurantScopedMixin, ListModelMixin, RetrieveModelMixin, GenericViewSet
):
    """Read-only viewset for order history."""

    queryset = Order.objects.select_related("payment_method").order_by("-created_at")
    permission_classes = [IsAuthenticated, IsRestaurantOwner]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return OrderDetailSerializer
        return OrderListSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        if self.action == "retrieve":
            queryset = queryset.prefetch_related(
                "items__product", "items__toppings__topping"
            )

        # Apply filters for list action
        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(status=status)

        date_from = self.request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset
