"""Serializers for the restaurants app."""

from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Owner, PaymentMethod, Restaurant


class RegistrationSerializer(serializers.Serializer):
    """Register a new owner and restaurant atomically."""

    owner_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    restaurant_name = serializers.CharField(max_length=200)

    def validate_email(self, value):
        if Owner.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "Ya existe una cuenta con este correo electrónico."
            )
        return value.lower()

    def validate_password(self, value):
        validate_password(value)
        return value

    @transaction.atomic
    def create(self, validated_data):
        owner = Owner.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["owner_name"],
        )

        restaurant = Restaurant.objects.create(
            owner=owner,
            name=validated_data["restaurant_name"],
            address_line="",
            telegram_chat_id="",
            delivery_fee=0,
        )

        refresh = RefreshToken.for_user(owner)

        return {
            "tokens": {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            "restaurant": {
                "id": str(restaurant.id),
                "name": restaurant.name,
                "slug": restaurant.slug,
            },
        }


class RestaurantBriefSerializer(serializers.ModelSerializer):
    """Brief restaurant representation for auth responses."""

    class Meta:
        model = Restaurant
        fields = ["id", "name", "slug"]
        read_only_fields = fields


class RestaurantSerializer(serializers.ModelSerializer):
    """Serializer for the restaurant profile (GET/PATCH)."""

    class Meta:
        model = Restaurant
        fields = [
            "id",
            "slug",
            "name",
            "logo_url",
            "address_line",
            "delivery_fee",
            "latitude",
            "longitude",
            "telegram_chat_id",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "slug", "logo_url", "is_active", "created_at"]


class PaymentMethodSerializer(serializers.ModelSerializer):
    """Serializer for payment methods with conditional validation."""

    class Meta:
        model = PaymentMethod
        fields = ["id", "type", "key_value", "is_active"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        # For updates, merge with existing instance values
        payment_type = attrs.get("type", getattr(self.instance, "type", None))
        key_value = attrs.get("key_value", getattr(self.instance, "key_value", ""))

        if payment_type == PaymentMethod.PaymentType.TRANSFER_WITH_KEY:
            if not key_value or not key_value.strip():
                raise serializers.ValidationError(
                    {
                        "key_value": [
                            "Este campo es requerido para transferencias con clave."
                        ]
                    }
                )
        return attrs
