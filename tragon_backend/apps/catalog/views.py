"""Views for the catalog app -- categories, products, toppings."""

import uuid

import boto3
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import (
    CreateModelMixin,
    ListModelMixin,
    UpdateModelMixin,
)
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from apps.restaurants.mixins import RestaurantScopedMixin
from apps.restaurants.models import Restaurant
from apps.restaurants.permissions import IsRestaurantOwner

from .models import Category, Product, Topping
from .serializers import (
    CategorySerializer,
    ProductLabelSerializer,
    ProductSerializer,
    PublicCategorySerializer,
    PublicProductSerializer,
    PublicRestaurantSerializer,
    ToppingSerializer,
)


class CategoryViewSet(
    RestaurantScopedMixin,
    CreateModelMixin,
    ListModelMixin,
    UpdateModelMixin,
    GenericViewSet,
):
    """
    CRUD for categories scoped to the authenticated owner's restaurant.

    DELETE is soft-delete (sets is_active=false).
    """

    queryset = Category.objects.filter(is_active=True)
    serializer_class = CategorySerializer
    permission_classes = [IsRestaurantOwner]
    http_method_names = ["get", "post", "patch", "delete"]

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductViewSet(
    CreateModelMixin,
    ListModelMixin,
    UpdateModelMixin,
    GenericViewSet,
):
    """
    CRUD for products scoped to the authenticated owner's restaurant.

    Products are scoped through their category's restaurant.
    Supports filtering by category_id query param.
    """

    queryset = Product.objects.filter(is_active=True)
    serializer_class = ProductSerializer
    permission_classes = [IsRestaurantOwner]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_authenticated and hasattr(
            self.request.user, "restaurant"
        ):
            restaurant = self.request.user.restaurant
            queryset = queryset.filter(category__restaurant=restaurant)
        else:
            return queryset.none()

        category_id = self.request.query_params.get("category_id")
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        return queryset

    def perform_create(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=["post"],
        url_path="upload-photo",
        parser_classes=[MultiPartParser],
    )
    def upload_photo(self, request, pk=None):
        """Upload product photo to S3 and save URL."""
        product = self.get_object()
        file = request.FILES.get("photo")

        if not file:
            return Response(
                {
                    "error": "validation_error",
                    "message": "No se proporcion\u00f3 un archivo de imagen.",
                    "details": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate unique filename
        ext = file.name.rsplit(".", 1)[-1] if "." in file.name else "jpg"
        filename = f"products/{product.id}/{uuid.uuid4().hex}.{ext}"

        try:
            s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME,
            )
            s3_client.upload_fileobj(
                file,
                settings.AWS_STORAGE_BUCKET_NAME,
                filename,
                ExtraArgs={"ContentType": file.content_type},
            )
            photo_url = (
                f"https://{settings.AWS_STORAGE_BUCKET_NAME}"
                f".s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{filename}"
            )
        except Exception:
            return Response(
                {
                    "error": "upload_failed",
                    "message": "Error al subir la imagen. Intente nuevamente.",
                    "details": {},
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        product.photo_url = photo_url
        product.save(update_fields=["photo_url"])

        serializer = self.get_serializer(product)
        return Response(serializer.data)

    @action(detail=True, methods=["patch"], url_path="label")
    def set_label(self, request, pk=None):
        """Set or clear the product's highlight label."""
        product = self.get_object()
        serializer = ProductLabelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        label_value = serializer.validated_data["label"]
        product.label = label_value if label_value else ""
        product.save(update_fields=["label"])

        return Response(ProductSerializer(product, context={"request": request}).data)


class ToppingListCreateViewSet(
    CreateModelMixin,
    ListModelMixin,
    GenericViewSet,
):
    """
    List/create toppings nested under a product.

    URL: /api/v1/catalog/products/{product_id}/toppings/
    """

    serializer_class = ToppingSerializer
    permission_classes = [IsRestaurantOwner]

    def get_queryset(self):
        product_id = self.kwargs.get("product_id")
        return Topping.objects.filter(product_id=product_id, is_active=True)

    def get_product(self):
        """Get and validate that the product belongs to the user's restaurant."""
        product_id = self.kwargs.get("product_id")
        try:
            product = Product.objects.get(
                pk=product_id,
                category__restaurant=self.request.user.restaurant,
                is_active=True,
            )
        except Product.DoesNotExist:
            return None
        return product

    def list(self, request, *args, **kwargs):
        product = self.get_product()
        if product is None:
            return Response(
                {
                    "error": "not_found",
                    "message": "El producto no fue encontrado.",
                    "details": {},
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        product = self.get_product()
        if product is None:
            return Response(
                {
                    "error": "not_found",
                    "message": "El producto no fue encontrado.",
                    "details": {},
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer.save(product=product)

    def create(self, request, *args, **kwargs):
        product = self.get_product()
        if product is None:
            return Response(
                {
                    "error": "not_found",
                    "message": "El producto no fue encontrado.",
                    "details": {},
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(product=product)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )


class ToppingDetailViewSet(
    UpdateModelMixin,
    GenericViewSet,
):
    """
    Update/delete individual toppings (flat URL).

    URL: /api/v1/catalog/toppings/{id}/
    """

    queryset = Topping.objects.filter(is_active=True)
    serializer_class = ToppingSerializer
    permission_classes = [IsRestaurantOwner]
    http_method_names = ["patch", "delete"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_authenticated and hasattr(
            self.request.user, "restaurant"
        ):
            restaurant = self.request.user.restaurant
            return queryset.filter(product__category__restaurant=restaurant)
        return queryset.none()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublicMenuView(APIView):
    """
    Public menu endpoint -- no authentication required.

    GET /api/v1/catalog/{slug}/menu/
    Returns restaurant info, active categories with active products/toppings,
    plus uncategorized products at the end.
    """

    permission_classes = [AllowAny]

    def get(self, request, slug):
        restaurant = get_object_or_404(Restaurant, slug=slug, is_active=True)

        # Active categories for this restaurant
        categories = Category.objects.filter(restaurant=restaurant, is_active=True)

        # Uncategorized products: category is NULL or belongs to an inactive
        # category of this restaurant (soft-deleted categories keep the FK).
        uncategorized_products = Product.objects.filter(
            is_active=True,
            category__restaurant=restaurant,
            category__is_active=False,
        ) | Product.objects.filter(
            is_active=True,
            category__isnull=True,
        )

        restaurant_data = PublicRestaurantSerializer(restaurant).data
        categories_data = PublicCategorySerializer(categories, many=True).data
        uncategorized_data = PublicProductSerializer(
            uncategorized_products, many=True
        ).data

        return Response(
            {
                "restaurant": restaurant_data,
                "categories": categories_data,
                "uncategorized_products": uncategorized_data,
            }
        )
