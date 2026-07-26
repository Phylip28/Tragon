"""Views for the restaurants app — authentication + restaurant profile + payment methods."""

import uuid

from django.conf import settings
from django.db import IntegrityError
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PaymentMethod
from .permissions import IsRestaurantOwner
from .serializers import (
    PaymentMethodSerializer,
    RegistrationSerializer,
    RestaurantSerializer,
)


class RegistrationView(APIView):
    """POST /api/v1/auth/register/ — creates Owner + Restaurant atomically."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_201_CREATED)


class RestaurantProfileView(APIView):
    """GET/PATCH /api/v1/restaurants/me/ — restaurant profile for the authenticated owner."""

    permission_classes = [IsRestaurantOwner]

    def get(self, request):
        restaurant = request.user.restaurant
        serializer = RestaurantSerializer(restaurant)
        return Response(serializer.data)

    def patch(self, request):
        restaurant = request.user.restaurant
        serializer = RestaurantSerializer(restaurant, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class RestaurantUploadLogoView(APIView):
    """POST /api/v1/restaurants/me/upload-logo/ — upload logo to S3 or local fallback."""

    permission_classes = [IsRestaurantOwner]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response(
                {
                    "error": "validation_error",
                    "message": "No se proporcionó un archivo.",
                    "details": {"file": ["Este campo es requerido."]},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        restaurant = request.user.restaurant
        logo_url = self._upload_file(file, restaurant)
        restaurant.logo_url = logo_url
        restaurant.save(update_fields=["logo_url"])

        return Response({"logo_url": logo_url}, status=status.HTTP_200_OK)

    def _upload_file(self, file, restaurant):
        """Upload file to S3 or fall back to placeholder URL in dev."""
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            return self._upload_to_s3(file, restaurant)
        # Development fallback: return a placeholder URL
        unique_name = f"{uuid.uuid4().hex}_{file.name}"
        return f"/media/logos/{restaurant.slug}/{unique_name}"

    def _upload_to_s3(self, file, restaurant):
        """Upload file to S3 and return the public URL."""
        import boto3

        s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME,
        )

        extension = file.name.rsplit(".", 1)[-1] if "." in file.name else "png"
        key = f"logos/{restaurant.slug}/{uuid.uuid4().hex}.{extension}"

        s3_client.upload_fileobj(
            file,
            settings.AWS_STORAGE_BUCKET_NAME,
            key,
            ExtraArgs={"ContentType": file.content_type},
        )

        url = (
            f"https://{settings.AWS_STORAGE_BUCKET_NAME}"
            f".s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{key}"
        )
        return url


# --- Payment Methods ---


class PaymentMethodListCreateView(APIView):
    """GET/POST /api/v1/restaurants/me/payment-methods/"""

    permission_classes = [IsRestaurantOwner]

    def get(self, request):
        restaurant = request.user.restaurant
        methods = PaymentMethod.objects.filter(restaurant=restaurant)
        serializer = PaymentMethodSerializer(methods, many=True)
        return Response(serializer.data)

    def post(self, request):
        restaurant = request.user.restaurant
        serializer = PaymentMethodSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save(restaurant=restaurant)
        except IntegrityError:
            return Response(
                {
                    "error": "duplicate_entry",
                    "message": "Ya existe un método de pago de este tipo para el restaurante.",
                    "details": {},
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PaymentMethodDetailView(APIView):
    """PATCH/DELETE /api/v1/restaurants/me/payment-methods/{id}/"""

    permission_classes = [IsRestaurantOwner]

    def _get_object(self, request, pk):
        try:
            return PaymentMethod.objects.get(pk=pk, restaurant=request.user.restaurant)
        except PaymentMethod.DoesNotExist:
            return None

    def patch(self, request, pk):
        instance = self._get_object(request, pk)
        if instance is None:
            return Response(
                {
                    "error": "not_found",
                    "message": "El recurso solicitado no fue encontrado.",
                    "details": {},
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = PaymentMethodSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save()
        except IntegrityError:
            return Response(
                {
                    "error": "duplicate_entry",
                    "message": "Ya existe un método de pago de este tipo para el restaurante.",
                    "details": {},
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(serializer.data)

    def delete(self, request, pk):
        instance = self._get_object(request, pk)
        if instance is None:
            return Response(
                {
                    "error": "not_found",
                    "message": "El recurso solicitado no fue encontrado.",
                    "details": {},
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
