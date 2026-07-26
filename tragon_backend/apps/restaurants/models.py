import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.text import slugify


class Owner(AbstractUser):
    """Restaurant owner account. Uses email as login credential."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "owner"

    def __str__(self):
        return self.email


class Restaurant(models.Model):
    """Restaurant profile."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=50, unique=True, editable=False)
    name = models.CharField(max_length=200)
    logo_url = models.TextField(blank=True, default="")
    address_line = models.TextField()
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    telegram_chat_id = models.CharField(max_length=100)
    delivery_fee = models.IntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "restaurant"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)[:50]
            slug = base_slug
            counter = 1
            while Restaurant.objects.filter(slug=slug).exists():
                suffix = f"-{counter}"
                slug = base_slug[: 50 - len(suffix)] + suffix
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class PaymentMethod(models.Model):
    """Payment method accepted by a restaurant."""

    class PaymentType(models.TextChoices):
        CASH = "cash", "Cash"
        TRANSFER = "transfer", "Transfer"
        TRANSFER_WITH_KEY = "transfer_with_key", "Transfer with key"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.RESTRICT,
        related_name="payment_methods",
    )
    type = models.CharField(max_length=30, choices=PaymentType.choices)
    key_value = models.CharField(max_length=200, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "payment_method"
        constraints = [
            models.UniqueConstraint(
                fields=["restaurant", "type"],
                name="unique_restaurant_payment_type",
            ),
            models.CheckConstraint(
                condition=~models.Q(type="transfer_with_key", key_value=""),
                name="require_key_value_for_transfer_with_key",
            ),
        ]

    def __str__(self):
        return f"{self.restaurant.name} - {self.get_type_display()}"
