import uuid

from django.db import models


class Category(models.Model):
    """Product category belonging to a restaurant."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.RESTRICT,
        related_name="categories",
    )
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "category"
        constraints = [
            models.UniqueConstraint(
                fields=["restaurant", "name"],
                name="unique_restaurant_category_name",
            ),
        ]

    def __str__(self):
        return self.name


class Product(models.Model):
    """Menu product belonging to a category."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
    )
    name = models.CharField(max_length=200)
    description = models.TextField(default="")
    photo_url = models.TextField(blank=True, default="")
    base_price = models.IntegerField()
    is_active = models.BooleanField(default=True)
    label = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        db_table = "product"

    def __str__(self):
        return self.name


class Topping(models.Model):
    """Optional topping/add-on for a product."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="toppings",
    )
    name = models.CharField(max_length=200)
    extra_price = models.IntegerField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "topping"

    def __str__(self):
        return self.name
