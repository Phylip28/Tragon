# Design Document — Restaurant Admin

## Overview

The restaurant-admin module provides the backend API and frontend management panel for restaurant owners to register, authenticate, configure their restaurant, manage menus, and process orders. It enforces multi-tenant isolation so each restaurant's data is accessible only through its own authentication context.

## Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Astro 7.x SSR + React Islands (Management Panel)          │
│  - Registration / Login pages                               │
│  - Restaurant config & white-label settings                 │
│  - Menu management (categories, products, toppings)         │
│  - Order management dashboard                               │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS (JWT in Authorization header)
┌─────────────────────▼───────────────────────────────────────┐
│  Django REST Framework API                                   │
│  - apps/accounts   → registration, login, token refresh     │
│  - apps/restaurants → profile, slug, white-label config     │
│  - apps/catalog    → categories, products, toppings         │
│  - apps/orders     → order CRUD, status transitions         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  PostgreSQL (AWS RDS) │ AWS S3 (images)                      │
└─────────────────────────────────────────────────────────────┘
```

### Backend Module Structure

```
tragon_backend/
├── config/
│   ├── settings/
│   │   ├── base.py          # Shared settings, installed apps, middleware
│   │   ├── development.py   # DEBUG=True, local DB, console email
│   │   └── production.py    # RDS, S3, Secrets Manager integration
│   ├── urls.py              # Root URL conf, versioned API prefix
│   └── asgi.py
├── apps/
│   ├── accounts/
│   │   ├── models.py        # Owner (extends AbstractUser)
│   │   ├── serializers.py   # RegistrationSerializer, OwnerSerializer
│   │   ├── views.py         # RegisterView, token endpoints
│   │   └── urls.py
│   ├── restaurants/
│   │   ├── models.py        # Restaurant, WhiteLabelConfig
│   │   ├── serializers.py   # RestaurantSerializer, WhiteLabelSerializer
│   │   ├── views.py         # RestaurantViewSet
│   │   ├── permissions.py   # IsRestaurantOwner
│   │   └── urls.py
│   ├── catalog/
│   │   ├── models.py        # Category, Product, Topping
│   │   ├── serializers.py   # CategorySerializer, ProductSerializer, ToppingSerializer
│   │   ├── views.py         # CategoryViewSet, ProductViewSet, ToppingViewSet
│   │   └── urls.py
│   ├── orders/
│   │   ├── models.py        # Order, OrderItem, OrderItemTopping
│   │   ├── serializers.py   # OrderSerializer, OrderListSerializer
│   │   ├── views.py         # OrderViewSet
│   │   ├── state_machine.py # Order status transitions
│   │   └── urls.py
│   └── notifications/
│       ├── services.py      # Telegram integration
│       └── urls.py
└── manage.py
```

### Frontend Structure (Astro 7.x)

```
tragon_frontend/
├── src/
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── login.astro
│   │   │   ├── register.astro
│   │   │   ├── dashboard.astro
│   │   │   ├── menu.astro
│   │   │   ├── orders.astro
│   │   │   └── settings.astro
│   │   └── [slug]/
│   │       └── index.astro      # Public menu page (white-labeled)
│   ├── components/
│   │   ├── admin/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   ├── MenuManager.tsx
│   │   │   ├── OrderList.tsx
│   │   │   └── SettingsForm.tsx
│   │   └── menu/
│   │       └── PublicMenu.tsx
│   ├── stores/
│   │   ├── auth.ts              # nanostores: tokens, refresh logic
│   │   └── restaurant.ts       # nanostores: current restaurant state
│   └── lib/
│       ├── api.ts               # Fetch wrapper with JWT injection
│       └── secrets.ts           # AWS Secrets Manager client
├── astro.config.mjs
└── package.json
```

## Data Models

### accounts.Owner

```python
from django.contrib.auth.models import AbstractUser
from django.db import models


class Owner(AbstractUser):
    id = models.AutoField(primary_key=True)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]
```

### restaurants.Restaurant

```python
from django.db import models
from django.utils.text import slugify
import secrets


class Restaurant(models.Model):
    id = models.AutoField(primary_key=True)
    owner = models.ForeignKey("accounts.Owner", on_delete=models.CASCADE, related_name="restaurants")
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True, editable=False)
    address = models.TextField(blank=True, default="")
    breb_key = models.CharField(max_length=255, blank=True, default="")
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    contact_phone = models.CharField(max_length=50, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            suffix = secrets.token_hex(3)  # 6 hex chars
            self.slug = f"{base_slug}-{suffix}"
        super().save(*args, **kwargs)
```

### restaurants.WhiteLabelConfig

```python
class WhiteLabelConfig(models.Model):
    id = models.AutoField(primary_key=True)
    restaurant = models.OneToOneField(Restaurant, on_delete=models.CASCADE, related_name="white_label")
    primary_color = models.CharField(max_length=7, default="#000000")
    secondary_color = models.CharField(max_length=7, default="#FFFFFF")
    logo_url = models.URLField(blank=True, default="")
    display_name = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### catalog.Category

```python
class Category(models.Model):
    id = models.AutoField(primary_key=True)
    restaurant = models.ForeignKey("restaurants.Restaurant", on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=200)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name"]
        unique_together = ["restaurant", "name"]
```

### catalog.Product

```python
class Product(models.Model):
    id = models.AutoField(primary_key=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="products")
    restaurant = models.ForeignKey("restaurants.Restaurant", on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    photo_url = models.URLField(blank=True, default="")
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    ingredients = models.TextField(blank=True, default="")
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### catalog.Topping

```python
class Topping(models.Model):
    id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="toppings")
    restaurant = models.ForeignKey("restaurants.Restaurant", on_delete=models.CASCADE, related_name="toppings")
    name = models.CharField(max_length=200)
    additional_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### orders.Order

```python
class Order(models.Model):
    class Status(models.TextChoices):
        RECEIVED = "received"
        CONFIRMED = "confirmed"
        IN_PREPARATION = "in_preparation"
        COMPLETED = "completed"
        CANCELLED = "cancelled"

    class DeliveryType(models.TextChoices):
        PICKUP = "pickup"
        DELIVERY = "delivery"

    class PaymentMethod(models.TextChoices):
        CASH = "cash"
        CARD = "card"
        TRANSFER = "transfer"

    VALID_TRANSITIONS = {
        Status.RECEIVED: [Status.CONFIRMED, Status.CANCELLED],
        Status.CONFIRMED: [Status.IN_PREPARATION, Status.CANCELLED],
        Status.IN_PREPARATION: [Status.COMPLETED, Status.CANCELLED],
        Status.COMPLETED: [],
        Status.CANCELLED: [],
    }

    id = models.AutoField(primary_key=True)
    restaurant = models.ForeignKey("restaurants.Restaurant", on_delete=models.CASCADE, related_name="orders")
    reference_number = models.CharField(max_length=20, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)
    delivery_type = models.CharField(max_length=20, choices=DeliveryType.choices)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    customer_name = models.CharField(max_length=200, blank=True, default="")
    customer_phone = models.CharField(max_length=50, blank=True, default="")
    delivery_address = models.TextField(blank=True, default="")
    total = models.DecimalField(max_digits=10, decimal_places=2)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in self.VALID_TRANSITIONS.get(self.status, [])
```

### orders.OrderItem

```python
class OrderItem(models.Model):
    id = models.AutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=200)  # Snapshot at order time
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### orders.OrderItemTopping

```python
class OrderItemTopping(models.Model):
    id = models.AutoField(primary_key=True)
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE, related_name="toppings")
    topping_name = models.CharField(max_length=200)  # Snapshot at order time
    additional_price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

## API Interfaces

### URL Configuration

All API endpoints are served under `/api/v1/`.

```python
# config/urls.py
urlpatterns = [
    path("api/v1/accounts/", include("apps.accounts.urls")),
    path("api/v1/restaurants/", include("apps.restaurants.urls")),
    path("api/v1/catalog/", include("apps.catalog.urls")),
    path("api/v1/orders/", include("apps.orders.urls")),
]
```

### Authentication Endpoints (apps/accounts)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/accounts/register/` | Register owner + restaurant | No |
| POST | `/api/v1/accounts/token/` | Obtain JWT pair | No |
| POST | `/api/v1/accounts/token/refresh/` | Refresh access token | No |

#### Registration Request/Response

```python
# Request
{
    "owner_name": "Juan Pérez",
    "email": "juan@example.com",
    "password": "securepassword123",
    "restaurant_name": "Tacos El Güero"
}

# Response 201
{
    "owner": {"id": 1, "email": "juan@example.com", "name": "Juan Pérez"},
    "restaurant": {"id": 1, "name": "Tacos El Güero", "slug": "tacos-el-guero-a3f1b2"},
    "tokens": {"access": "eyJ...", "refresh": "eyJ..."}
}
```

### Restaurant Endpoints (apps/restaurants)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/restaurants/me/` | Get own restaurant profile | JWT |
| PATCH | `/api/v1/restaurants/me/` | Update restaurant profile | JWT |
| GET | `/api/v1/restaurants/me/white-label/` | Get white-label config | JWT |
| PUT | `/api/v1/restaurants/me/white-label/` | Update white-label config | JWT |
| GET | `/api/v1/restaurants/{slug}/public/` | Public restaurant data + white-label | No |

The `slug` field is excluded from writable serializer fields. Any attempt to include it in PATCH payload is silently ignored.

### Catalog Endpoints (apps/catalog)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/catalog/categories/` | List categories | JWT |
| POST | `/api/v1/catalog/categories/` | Create category | JWT |
| PATCH | `/api/v1/catalog/categories/{id}/` | Update category | JWT |
| DELETE | `/api/v1/catalog/categories/{id}/` | Delete category | JWT |
| GET | `/api/v1/catalog/products/` | List products | JWT |
| POST | `/api/v1/catalog/products/` | Create product | JWT |
| PATCH | `/api/v1/catalog/products/{id}/` | Update product | JWT |
| DELETE | `/api/v1/catalog/products/{id}/` | Delete product | JWT |
| POST | `/api/v1/catalog/products/{id}/upload-photo/` | Upload product photo | JWT |
| GET | `/api/v1/catalog/toppings/` | List toppings | JWT |
| POST | `/api/v1/catalog/toppings/` | Create topping | JWT |
| PATCH | `/api/v1/catalog/toppings/{id}/` | Update topping | JWT |
| DELETE | `/api/v1/catalog/toppings/{id}/` | Delete topping | JWT |
| GET | `/api/v1/catalog/{slug}/menu/` | Public full menu | No |

All JWT-protected catalog endpoints automatically filter by the restaurant associated with the authenticated owner's JWT.

### Order Endpoints (apps/orders)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/orders/` | List orders (with filters) | JWT |
| GET | `/api/v1/orders/{id}/` | Get order detail | JWT |
| PATCH | `/api/v1/orders/{id}/status/` | Change order status | JWT |
| POST | `/api/v1/orders/{id}/cancel/` | Cancel order | JWT |

#### Order Filters (query params)

- `status` — Filter by order status
- `date_from` — ISO date, orders created on or after
- `date_to` — ISO date, orders created on or before

## Component Design

### Multi-Tenant Isolation Mixin

```python
class RestaurantScopedMixin:
    """
    Mixin for ViewSets that automatically filters querysets
    by the authenticated owner's restaurant.
    """

    def get_queryset(self):
        qs = super().get_queryset()
        restaurant = self.request.user.restaurants.first()
        return qs.filter(restaurant=restaurant)

    def perform_create(self, serializer):
        restaurant = self.request.user.restaurants.first()
        serializer.save(restaurant=restaurant)
```

All catalog and order ViewSets inherit from this mixin, ensuring data isolation at the queryset level.

### Slug Generation

```python
from django.utils.text import slugify
import secrets


def generate_unique_slug(name: str) -> str:
    """Generate a URL-safe slug from a restaurant name with a random suffix."""
    base = slugify(name)
    if not base:
        base = "restaurant"
    suffix = secrets.token_hex(3)
    return f"{base}-{suffix}"
```

The slug is generated once at creation time and stored as a non-editable field. The serializer explicitly excludes `slug` from writable fields.

### Order State Machine

```python
from apps.orders.models import Order


class OrderStateMachine:
    """Validates and executes order status transitions."""

    @staticmethod
    def transition(order: Order, new_status: str) -> Order:
        if not order.can_transition_to(new_status):
            raise InvalidTransitionError(
                f"Cannot transition from {order.status} to {new_status}"
            )
        order.status = new_status
        order.save(update_fields=["status", "updated_at"])
        return order
```

### JWT Configuration

```python
# config/settings/base.py
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}
```

### Frontend Auth Store (nanostores)

```typescript
// src/stores/auth.ts
import { atom, computed } from "nanostores";

export const $accessToken = atom<string | null>(null);
export const $refreshToken = atom<string | null>(null);
export const $isAuthenticated = computed($accessToken, (token) => token !== null);

export async function refreshAccessToken(): Promise<boolean> {
  const refresh = $refreshToken.get();
  if (!refresh) return false;

  const res = await fetch("/api/v1/accounts/token/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) {
    $accessToken.set(null);
    $refreshToken.set(null);
    return false;
  }

  const data = await res.json();
  $accessToken.set(data.access);
  if (data.refresh) $refreshToken.set(data.refresh);
  return true;
}
```

### Frontend API Client

```typescript
// src/lib/api.ts
import { $accessToken, refreshAccessToken } from "../stores/auth";

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = $accessToken.get();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(path, { ...options, headers });

  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${$accessToken.get()}`);
      response = await fetch(path, { ...options, headers });
    }
  }

  return response;
}
```

### S3 Image Upload

```python
import boto3
from django.conf import settings
import uuid


def upload_product_image(file, restaurant_slug: str) -> str:
    """Upload image to S3 and return the public URL."""
    s3_client = boto3.client("s3")
    ext = file.name.rsplit(".", 1)[-1] if "." in file.name else "jpg"
    key = f"restaurants/{restaurant_slug}/products/{uuid.uuid4().hex}.{ext}"

    s3_client.upload_fileobj(
        file,
        settings.AWS_STORAGE_BUCKET_NAME,
        key,
        ExtraArgs={"ContentType": file.content_type},
    )

    return f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com/{key}"
```

## Error Handling

### API Error Responses

All API errors follow a consistent JSON format:

```python
{
    "error": "error_code",
    "message": "Human-readable description",
    "details": {}  # Optional field-level errors
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `validation_error` | 400 | Request body validation failed |
| `invalid_credentials` | 401 | Wrong email/password |
| `token_expired` | 401 | JWT access token expired |
| `refresh_token_expired` | 401 | JWT refresh token expired |
| `not_found` | 404 | Resource does not exist or belongs to another restaurant |
| `invalid_transition` | 409 | Order status transition not allowed |
| `upload_failed` | 500 | S3 upload failed |

### Custom Exception Handler

```python
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        response.data = {
            "error": getattr(exc, "default_code", "error"),
            "message": str(exc.detail) if hasattr(exc, "detail") else str(exc),
            "details": response.data if isinstance(response.data, dict) else {},
        }
    return response
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Slug derivation from restaurant name

*For any* valid restaurant name, the generated slug SHALL contain a slugified version of the name as a prefix followed by a hyphen and a 6-character hexadecimal suffix, and the result SHALL be a valid URL slug.

**Validates: Requirements 1.2**

### Property 2: Login returns valid JWT pair

*For any* registered owner with valid credentials, calling the token endpoint SHALL return a response containing both a non-empty access token and a non-empty refresh token.

**Validates: Requirements 1.4**

### Property 3: Slug immutability

*For any* existing restaurant and any PATCH request to the restaurant profile endpoint that includes a `slug` field, the stored slug SHALL remain equal to its original value after the request completes.

**Validates: Requirements 2.1, 2.4**

### Property 4: Restaurant configuration round-trip

*For any* valid restaurant configuration payload (name, address, delivery_fee, contact information), writing it via the PATCH endpoint and then reading it back via the GET endpoint SHALL return field values identical to those written.

**Validates: Requirements 2.3**

### Property 5: White-label configuration round-trip

*For any* valid white-label configuration (primary_color, secondary_color, logo_url, display_name), storing it via the PUT endpoint and retrieving it via the public menu endpoint SHALL return the same configuration values.

**Validates: Requirements 3.3**

### Property 6: Menu entity CRUD round-trip

*For any* valid category, product, or topping data, creating the entity via the POST endpoint and then retrieving it via the GET endpoint SHALL return field values identical to those submitted (excluding server-generated fields like id and timestamps).

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 7: JWT protection on menu endpoints

*For any* catalog API endpoint (categories, products, toppings), a request without a valid JWT Authorization header SHALL receive a 401 response status code.

**Validates: Requirements 4.5**

### Property 8: Order state machine validity

*For any* order in a given status and any target status, the transition SHALL succeed if and only if the target status is in the set of valid transitions for the current status (received→confirmed/cancelled, confirmed→in_preparation/cancelled, in_preparation→completed/cancelled, completed→∅, cancelled→∅).

**Validates: Requirements 5.2, 5.3**

### Property 9: Order filter correctness

*For any* set of orders and any combination of date_from, date_to, and status filter parameters, all orders in the response SHALL satisfy every applied filter criterion, and no order satisfying all criteria SHALL be excluded from the response.

**Validates: Requirements 5.4**

### Property 10: Order serialization completeness

*For any* order returned by the list endpoint, the serialized representation SHALL contain all required fields: reference_number, created_at (date), items (summary), total, delivery_type, payment_method, and status.

**Validates: Requirements 5.5**

### Property 11: Multi-restaurant data isolation

*For any* two distinct restaurants A and B, authenticating as restaurant A's owner and requesting any resource (categories, products, toppings, orders, configuration) SHALL return only resources belonging to restaurant A, and SHALL never include resources belonging to restaurant B.

**Validates: Requirements 6.1, 6.2**

### Property 12: White-label rendering application

*For any* restaurant with a configured white-label (primary_color, secondary_color, logo_url, display_name), the public menu page for that restaurant's slug SHALL apply those values in the rendered interface.

**Validates: Requirements 3.2**
