import uuid

from django.db import models


class Order(models.Model):
    """Order placed at a restaurant. Read-only in this module."""

    class DeliveryType(models.TextChoices):
        DELIVERY = "delivery", "Delivery"
        PICKUP = "pickup", "Pickup"
        DINE_IN = "dine_in", "Dine in"

    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        CONFIRMED = "confirmed", "Confirmed"
        IN_PREPARATION = "in_preparation", "In preparation"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference_number = models.CharField(max_length=20, unique=True)
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.RESTRICT,
        related_name="orders",
    )
    delivery_type = models.CharField(max_length=30, choices=DeliveryType.choices)
    address_line = models.TextField(blank=True, default="")
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    payment_method = models.ForeignKey(
        "restaurants.PaymentMethod",
        on_delete=models.RESTRICT,
        related_name="orders",
    )
    cash_denomination = models.IntegerField(null=True, blank=True)
    subtotal = models.IntegerField(null=True, blank=True)
    delivery_fee = models.IntegerField(null=True, blank=True)
    total = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=Status.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "order"
        indexes = [
            models.Index(
                fields=["restaurant", "created_at"],
                name="idx_order_restaurant_created",
            ),
            models.Index(
                fields=["status"],
                name="idx_order_status",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(delivery_type__in=["delivery", "pickup", "dine_in"]),
                name="order_valid_delivery_type",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    status__in=[
                        "received",
                        "confirmed",
                        "in_preparation",
                        "completed",
                        "cancelled",
                    ]
                ),
                name="order_valid_status",
            ),
        ]

    def __str__(self):
        return self.reference_number


class OrderItem(models.Model):
    """Line item within an order."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.RESTRICT,
        related_name="items",
    )
    product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.RESTRICT,
        related_name="order_items",
    )
    notes = models.TextField(blank=True, default="")
    unit_price = models.IntegerField()

    class Meta:
        db_table = "order_item"
        indexes = [
            models.Index(
                fields=["order"],
                name="idx_order_item_order",
            ),
        ]

    def __str__(self):
        return f"Item {self.id} (Order {self.order.reference_number})"


class OrderItemTopping(models.Model):
    """Topping selected for an order item."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.RESTRICT,
        related_name="toppings",
    )
    topping = models.ForeignKey(
        "catalog.Topping",
        on_delete=models.RESTRICT,
        related_name="order_item_toppings",
    )
    extra_price = models.IntegerField()

    class Meta:
        db_table = "order_item_topping"
        indexes = [
            models.Index(
                fields=["order_item"],
                name="idx_order_item_topping_item",
            ),
        ]

    def __str__(self):
        return f"Topping {self.id} (Item {self.order_item_id})"
