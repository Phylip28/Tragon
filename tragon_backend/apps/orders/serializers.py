"""Serializers for the orders app (read-only)."""

from rest_framework import serializers

from apps.orders.models import Order, OrderItem, OrderItemTopping


class OrderItemToppingSerializer(serializers.ModelSerializer):
    """Topping within an order item."""

    name = serializers.CharField(source="topping.name", read_only=True)

    class Meta:
        model = OrderItemTopping
        fields = ["name", "extra_price"]


class OrderItemSerializer(serializers.ModelSerializer):
    """Line item within an order detail."""

    product_name = serializers.CharField(source="product.name", read_only=True)
    toppings = OrderItemToppingSerializer(many=True, read_only=True)

    class Meta:
        model = OrderItem
        fields = ["product_name", "unit_price", "notes", "toppings"]


class OrderListSerializer(serializers.ModelSerializer):
    """Serializer for the order list endpoint."""

    payment_method_type = serializers.CharField(
        source="payment_method.type", read_only=True
    )

    class Meta:
        model = Order
        fields = [
            "id",
            "reference_number",
            "created_at",
            "status",
            "delivery_type",
            "total",
            "payment_method_type",
        ]


class OrderDetailSerializer(serializers.ModelSerializer):
    """Serializer for the order detail endpoint."""

    payment_method_type = serializers.CharField(
        source="payment_method.type", read_only=True
    )
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "reference_number",
            "created_at",
            "status",
            "delivery_type",
            "total",
            "payment_method_type",
            "items",
        ]
