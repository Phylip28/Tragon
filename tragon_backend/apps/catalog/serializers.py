"""Serializers for the catalog app."""

from rest_framework import serializers

from apps.restaurants.models import Restaurant

from .models import Category, Product, Topping


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for Category CRUD operations."""

    class Meta:
        model = Category
        fields = ["id", "name", "is_active"]
        read_only_fields = ["id", "is_active"]

    def validate_name(self, value):
        """Ensure category name is unique within the restaurant."""
        request = self.context["request"]
        restaurant = request.user.restaurant

        queryset = Category.objects.filter(restaurant=restaurant, name=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe una categoría con este nombre en tu restaurante."
            )
        return value


class ProductSerializer(serializers.ModelSerializer):
    """Serializer for Product CRUD operations."""

    class Meta:
        model = Product
        fields = [
            "id",
            "category",
            "name",
            "description",
            "photo_url",
            "base_price",
            "is_active",
            "label",
        ]
        read_only_fields = ["id", "photo_url", "is_active"]

    def validate_category(self, value):
        """Ensure category belongs to the authenticated user's restaurant."""
        if value is None:
            return value
        request = self.context["request"]
        restaurant = request.user.restaurant
        if value.restaurant != restaurant:
            raise serializers.ValidationError(
                "La categoría no pertenece a tu restaurante."
            )
        return value


class ProductLabelSerializer(serializers.Serializer):
    """Serializer for setting/clearing a product's highlight label."""

    label = serializers.CharField(max_length=50, allow_null=True, required=True)


class ToppingSerializer(serializers.ModelSerializer):
    """Serializer for Topping CRUD operations."""

    class Meta:
        model = Topping
        fields = ["id", "product", "name", "extra_price", "is_active"]
        read_only_fields = ["id", "product", "is_active"]


# --- Public menu serializers (no auth) ---


class PublicToppingSerializer(serializers.ModelSerializer):
    """Topping data for the public menu."""

    class Meta:
        model = Topping
        fields = ["id", "name", "extra_price"]


class PublicProductSerializer(serializers.ModelSerializer):
    """Product data for the public menu, including active toppings."""

    toppings = PublicToppingSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "photo_url",
            "base_price",
            "label",
            "toppings",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Only include active toppings
        data["toppings"] = PublicToppingSerializer(
            instance.toppings.filter(is_active=True), many=True
        ).data
        return data


class PublicCategorySerializer(serializers.ModelSerializer):
    """Category with its active products for the public menu."""

    products = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "products"]

    def get_products(self, obj):
        active_products = obj.products.filter(is_active=True)
        return PublicProductSerializer(active_products, many=True).data


class PublicRestaurantSerializer(serializers.ModelSerializer):
    """Basic restaurant info for the public menu."""

    class Meta:
        model = Restaurant
        fields = ["name", "slug", "logo_url", "address_line", "delivery_fee"]
