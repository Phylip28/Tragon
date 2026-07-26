"""Serializers for the restaurants app."""

from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Owner, Restaurant


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
