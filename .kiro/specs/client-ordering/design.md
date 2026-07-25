# Design Document — Client Ordering

## Overview

The client-ordering module provides the public-facing customer experience: browsing a restaurant menu via a shareable URL, building a cart, selecting delivery/payment options, and submitting an order. It reuses all data models from `restaurant-admin` and adds a single unauthenticated endpoint for order creation plus Telegram notification delivery.

## Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Astro 7.x SSR Page: /[slug]/                              │
│  - MenuPage (categories, products)                          │
│  - ProductDetail modal (toppings, instructions)             │
│  - OrderBar (item count, cancel, pay)                       │
│  - DeliveryTypeStep / AddressForm                           │
│  - PaymentMethodStep                                        │
│  - ConfirmationScreen                                       │
│  Cart state: nanostores (client-side only)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS (no auth)
┌─────────────────────▼───────────────────────────────────────┐
│  Django REST Framework API                                   │
│  - GET  /api/v1/catalog/{slug}/menu/     (existing)         │
│  - GET  /api/v1/restaurants/{slug}/public/ (existing)       │
│  - POST /api/v1/orders/                  (new, no auth)     │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  PostgreSQL │ Telegram Bot API (python-telegram-bot 22.2)    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Client browser
  │
  ├─ GET /api/v1/restaurants/{slug}/public/  → Restaurant + WhiteLabelConfig
  ├─ GET /api/v1/catalog/{slug}/menu/        → Categories → Products → Toppings
  │
  │  (client builds cart locally in nanostores)
  │
  └─ POST /api/v1/orders/  { slug, items[], delivery_type, address?, payment_method, ... }
       │
       ├─ Validate products belong to restaurant
       ├─ Persist Order + OrderItems + OrderItemToppings
       ├─ Send Telegram message to client (fire-and-forget)
       └─ Return 201 { order_id, reference_number }
```

## Components

### Backend: Public Order Creation Endpoint

Located in `apps/orders/views.py`, this adds a new view alongside the existing `OrderViewSet`.

```python
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle


class OrderCreateThrottle(AnonRateThrottle):
    rate = "10/minute"


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([OrderCreateThrottle])
def create_public_order(request):
    """
    Public endpoint for clients to submit orders without authentication.
    Identifies the restaurant by slug in the request body.
    """
    serializer = PublicOrderCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    order = serializer.save()

    # Fire-and-forget Telegram notification
    send_order_telegram_notification(order)

    return Response(
        {"order_id": order.id, "reference_number": order.reference_number},
        status=status.HTTP_201_CREATED,
    )
```

### Backend: Public Order Serializer

```python
from rest_framework import serializers
from apps.orders.models import Order, OrderItem, OrderItemTopping
from apps.restaurants.models import Restaurant
from apps.catalog.models import Product, Topping
import secrets


class OrderItemToppingCreateSerializer(serializers.Serializer):
    topping_id = serializers.IntegerField()


class OrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    toppings = OrderItemToppingCreateSerializer(many=True, required=False, default=[])
    special_instructions = serializers.CharField(
        required=False, default="", allow_blank=True
    )


class PublicOrderCreateSerializer(serializers.Serializer):
    restaurant_slug = serializers.SlugField()
    items = OrderItemCreateSerializer(many=True, min_length=1)
    delivery_type = serializers.ChoiceField(
        choices=["delivery", "pickup", "dine_in"]
    )
    payment_method = serializers.ChoiceField(choices=["cash", "transfer"])
    customer_name = serializers.CharField(max_length=200)
    customer_phone = serializers.CharField(max_length=50)
    bill_denomination = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )
    # Address fields (required when delivery_type == "delivery")
    street_type = serializers.CharField(max_length=50, required=False, default="")
    road_number = serializers.CharField(max_length=20, required=False, default="")
    cross_number = serializers.CharField(max_length=20, required=False, default="")
    building_number = serializers.CharField(max_length=20, required=False, default="")
    neighborhood = serializers.CharField(max_length=100, required=False, default="")
    city = serializers.CharField(max_length=100, required=False, default="")
    address_details = serializers.CharField(required=False, default="", allow_blank=True)
    notes = serializers.CharField(required=False, default="", allow_blank=True)
    telegram_chat_id = serializers.CharField(max_length=100, required=False, default="")

    def validate(self, attrs):
        # Validate restaurant exists
        try:
            restaurant = Restaurant.objects.get(slug=attrs["restaurant_slug"])
        except Restaurant.DoesNotExist:
            raise serializers.ValidationError(
                {"restaurant_slug": "Restaurant not found."}
            )
        attrs["restaurant"] = restaurant

        # Validate address fields when delivery
        if attrs["delivery_type"] == "delivery":
            required_address_fields = [
                "street_type", "road_number", "cross_number",
                "building_number", "neighborhood", "city",
            ]
            missing = [f for f in required_address_fields if not attrs.get(f)]
            if missing:
                raise serializers.ValidationError(
                    {f: "This field is required for delivery." for f in missing}
                )

        # Validate bill_denomination when cash
        if attrs["payment_method"] == "cash" and not attrs.get("bill_denomination"):
            raise serializers.ValidationError(
                {"bill_denomination": "Required when paying with cash."}
            )

        # Validate all products belong to this restaurant
        product_ids = [item["product_id"] for item in attrs["items"]]
        valid_products = Product.objects.filter(
            id__in=product_ids, restaurant=restaurant, is_available=True
        )
        valid_ids = set(valid_products.values_list("id", flat=True))
        invalid_ids = set(product_ids) - valid_ids
        if invalid_ids:
            raise serializers.ValidationError(
                {"items": f"Products {invalid_ids} not found or unavailable."}
            )
        attrs["products_map"] = {p.id: p for p in valid_products}

        # Validate toppings belong to their respective products
        for item_data in attrs["items"]:
            product = attrs["products_map"][item_data["product_id"]]
            topping_ids = [t["topping_id"] for t in item_data.get("toppings", [])]
            if topping_ids:
                valid_toppings = Topping.objects.filter(
                    id__in=topping_ids, product=product
                )
                if valid_toppings.count() != len(topping_ids):
                    raise serializers.ValidationError(
                        {"items": f"Invalid toppings for product {product.id}."}
                    )

        return attrs

    def create(self, validated_data):
        restaurant = validated_data["restaurant"]
        products_map = validated_data["products_map"]
        items_data = validated_data.pop("items")

        # Build delivery address string
        delivery_address = ""
        if validated_data["delivery_type"] == "delivery":
            delivery_address = (
                f"{validated_data['street_type']} {validated_data['road_number']} "
                f"# {validated_data['cross_number']} - {validated_data['building_number']}, "
                f"{validated_data['neighborhood']}, {validated_data['city']}"
            )
            if validated_data.get("address_details"):
                delivery_address += f" ({validated_data['address_details']})"

        # Calculate total
        total = 0
        for item_data in items_data:
            product = products_map[item_data["product_id"]]
            item_total = product.base_price * item_data["quantity"]
            for topping_data in item_data.get("toppings", []):
                topping = Topping.objects.get(id=topping_data["topping_id"])
                item_total += topping.additional_price * item_data["quantity"]
            total += item_total

        if validated_data["delivery_type"] == "delivery":
            total += restaurant.delivery_fee

        # Create order
        order = Order.objects.create(
            restaurant=restaurant,
            reference_number=secrets.token_hex(5).upper(),
            status=Order.Status.RECEIVED,
            delivery_type=validated_data["delivery_type"],
            payment_method=validated_data["payment_method"],
            customer_name=validated_data["customer_name"],
            customer_phone=validated_data["customer_phone"],
            delivery_address=delivery_address,
            total=total,
            notes=validated_data.get("notes", ""),
        )

        # Create order items and toppings
        for item_data in items_data:
            product = products_map[item_data["product_id"]]
            order_item = OrderItem.objects.create(
                order=order,
                product=product,
                product_name=product.name,
                quantity=item_data["quantity"],
                unit_price=product.base_price,
            )
            for topping_data in item_data.get("toppings", []):
                topping = Topping.objects.get(id=topping_data["topping_id"])
                OrderItemTopping.objects.create(
                    order_item=order_item,
                    topping_name=topping.name,
                    additional_price=topping.additional_price,
                )

        # Store telegram_chat_id on the order for notification
        order._telegram_chat_id = validated_data.get("telegram_chat_id", "")
        return order
```

### Backend: Telegram Notification Service

```python
# apps/notifications/services.py
import logging
from django.conf import settings
from telegram import Bot
from telegram.error import TelegramError

logger = logging.getLogger(__name__)


def format_order_message(order) -> str:
    """Format order details into a readable Telegram message."""
    lines = [
        f"🧾 *Order #{order.reference_number}*",
        f"Restaurant: {order.restaurant.name}",
        "",
        "*Items:*",
    ]

    for item in order.items.all():
        item_line = f"  • {item.quantity}x {item.product_name} — ${item.unit_price}"
        lines.append(item_line)
        for topping in item.toppings.all():
            lines.append(f"    + {topping.topping_name} (${topping.additional_price})")

    lines.append("")
    lines.append(f"*Delivery:* {order.delivery_type}")
    if order.delivery_address:
        lines.append(f"*Address:* {order.delivery_address}")
    lines.append(f"*Payment:* {order.payment_method}")
    lines.append(f"*Total:* ${order.total}")

    if order.notes:
        lines.append(f"*Notes:* {order.notes}")

    return "\n".join(lines)


def send_order_telegram_notification(order) -> None:
    """
    Send order confirmation to the client's Telegram chat.
    Fire-and-forget: logs errors but does not raise.
    """
    chat_id = getattr(order, "_telegram_chat_id", "")
    if not chat_id or not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("Telegram notification skipped: missing chat_id or bot token.")
        return

    try:
        bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
        message = format_order_message(order)
        bot.send_message(chat_id=chat_id, text=message, parse_mode="Markdown")
    except TelegramError as e:
        logger.error(f"Telegram notification failed for order {order.id}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error sending Telegram notification: {e}")
```

### Backend: URL Configuration Addition

```python
# apps/orders/urls.py (additions for client-ordering)
from django.urls import path
from apps.orders.views import create_public_order

urlpatterns += [
    path("", create_public_order, name="create-public-order"),
]
```

### Backend: Throttling Configuration

```python
# config/settings/base.py (additions)
REST_FRAMEWORK = {
    # ... existing config ...
    "DEFAULT_THROTTLE_RATES": {
        "anon": "10/minute",
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN", default="")
```

## Frontend Components

### Page: `/[slug]/index.astro`

SSR page that fetches restaurant data and public menu at build/request time, then hydrates React islands for interactivity.

```astro
---
// src/pages/[slug]/index.astro
const { slug } = Astro.params;

const restaurantRes = await fetch(
  `${import.meta.env.API_BASE}/api/v1/restaurants/${slug}/public/`
);
if (!restaurantRes.ok) return Astro.redirect("/404");
const restaurant = await restaurantRes.json();

const menuRes = await fetch(
  `${import.meta.env.API_BASE}/api/v1/catalog/${slug}/menu/`
);
const menu = await menuRes.json();
---

<html>
  <head>
    <title>{restaurant.white_label?.display_name || restaurant.name}</title>
    <style define:vars={{
      primaryColor: restaurant.white_label?.primary_color || '#000',
      secondaryColor: restaurant.white_label?.secondary_color || '#FFF',
    }}></style>
  </head>
  <body>
    <MenuPage client:load restaurant={restaurant} menu={menu} />
  </body>
</html>
```

### Cart Store (nanostores)

```typescript
// src/stores/cart.ts
import { atom, computed } from "nanostores";

export interface CartItemTopping {
  topping_id: number;
  name: string;
  additional_price: number;
}

export interface CartItem {
  id: string; // UUID generated client-side for uniqueness
  product_id: number;
  product_name: string;
  photo_url: string;
  base_price: number;
  quantity: number;
  toppings: CartItemTopping[];
  special_instructions: string;
}

export const $cartItems = atom<CartItem[]>([]);

export const $cartItemCount = computed($cartItems, (items) =>
  items.reduce((sum, item) => sum + item.quantity, 0)
);

export const $cartSubtotal = computed($cartItems, (items) =>
  items.reduce((sum, item) => {
    const toppingsTotal = item.toppings.reduce(
      (t, topping) => t + topping.additional_price,
      0
    );
    return sum + (item.base_price + toppingsTotal) * item.quantity;
  }, 0)
);

export function addToCart(item: Omit<CartItem, "id">): void {
  const id = crypto.randomUUID();
  $cartItems.set([...$cartItems.get(), { ...item, id }]);
}

export function removeFromCart(id: string): void {
  $cartItems.set($cartItems.get().filter((item) => item.id !== id));
}

export function clearCart(): void {
  $cartItems.set([]);
}
```

### Component: MenuPage

```typescript
// src/components/menu/MenuPage.tsx
interface MenuPageProps {
  restaurant: Restaurant;
  menu: Category[];
}

// Renders:
// - Restaurant header (logo, display_name) with white-label colors
// - CategorySection for each category
// - OrderBar fixed at bottom (item count, Cancel order, Pay)
// - ProductDetail modal (shown on product tap)
// - Checkout flow (DeliveryTypeStep → AddressForm → PaymentMethodStep → ConfirmationScreen)
```

### Component: CategorySection

Renders a category heading followed by a grid of `ProductCard` components.

### Component: ProductCard

Displays product photo and name. Tapping opens `ProductDetail` modal.

### Component: ProductDetail (Modal)

Displays full product info: photo, name, ingredients, toppings with checkboxes and prices, and a special instructions text field. Buttons: "Accept" (adds to cart) and "Cancel" (closes modal).

### Component: OrderBar

Fixed bottom bar showing:
- Total item count badge (from `$cartItemCount`)
- "Cancel order" button → calls `clearCart()`
- "Pay" button → opens `DeliveryTypeStep`

### Component: DeliveryTypeStep

Radio options: delivery, pickup, dine-in.
- Delivery: shows `AddressForm`
- Pickup/Dine-in: shows restaurant address text

### Component: AddressForm

Colombian address fields:
- `street_type` (Calle, Carrera, Avenida, Transversal, Diagonal — select)
- `road_number` (text)
- `cross_number` (text)
- `building_number` (text)
- `neighborhood` (text)
- `city` (text)
- `address_details` (optional textarea)

Validation: all fields except `address_details` are required when delivery is selected.

### Component: PaymentMethodStep

Radio options: cash, transfer.
- Cash: shows subtotal, delivery fee (if delivery), total, and `bill_denomination` input field (required).
- Transfer: shows Bre-b key, subtotal, delivery fee, total, instructions text, and a copy-to-clipboard button.

### Component: ConfirmationScreen

Displayed after successful order submission. Shows:
- Order reference number
- Item summary with toppings
- Delivery type and address
- Payment method
- Total

### Address Validation Logic

```typescript
// src/lib/validation.ts
export interface AddressFields {
  street_type: string;
  road_number: string;
  cross_number: string;
  building_number: string;
  neighborhood: string;
  city: string;
  address_details?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const REQUIRED_ADDRESS_FIELDS: (keyof AddressFields)[] = [
  "street_type",
  "road_number",
  "cross_number",
  "building_number",
  "neighborhood",
  "city",
];

export function validateAddress(fields: AddressFields): ValidationResult {
  const errors: Record<string, string> = {};

  for (const field of REQUIRED_ADDRESS_FIELDS) {
    if (!fields[field] || fields[field].trim() === "") {
      errors[field] = "This field is required.";
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
```

### Order Total Computation

```typescript
// src/lib/pricing.ts
import type { CartItem } from "../stores/cart";

export interface OrderTotal {
  subtotal: number;
  delivery_fee: number;
  total: number;
}

export function computeOrderTotal(
  items: CartItem[],
  deliveryFee: number,
  deliveryType: string
): OrderTotal {
  const subtotal = items.reduce((sum, item) => {
    const toppingsPrice = item.toppings.reduce(
      (t, topping) => t + topping.additional_price,
      0
    );
    return sum + (item.base_price + toppingsPrice) * item.quantity;
  }, 0);

  const fee = deliveryType === "delivery" ? deliveryFee : 0;

  return {
    subtotal,
    delivery_fee: fee,
    total: subtotal + fee,
  };
}
```

## API Interfaces

### New Endpoint

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/orders/` | Create order (public, no auth) | No |

### Existing Endpoints Used

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/restaurants/{slug}/public/` | Restaurant + white-label config | No |
| GET | `/api/v1/catalog/{slug}/menu/` | Full menu (categories, products, toppings) | No |

### POST /api/v1/orders/ — Request

```json
{
  "restaurant_slug": "tacos-el-guero-a3f1b2",
  "items": [
    {
      "product_id": 5,
      "quantity": 2,
      "toppings": [{"topping_id": 3}],
      "special_instructions": "Extra salsa"
    }
  ],
  "delivery_type": "delivery",
  "payment_method": "cash",
  "customer_name": "María García",
  "customer_phone": "+573001234567",
  "bill_denomination": 50000,
  "street_type": "Calle",
  "road_number": "45",
  "cross_number": "12",
  "building_number": "30",
  "neighborhood": "Laureles",
  "city": "Medellín",
  "address_details": "Apto 301",
  "notes": "",
  "telegram_chat_id": "123456789"
}
```

### POST /api/v1/orders/ — Response 201

```json
{
  "order_id": 42,
  "reference_number": "A3F1B2C8D9"
}
```

### POST /api/v1/orders/ — Error 400

```json
{
  "error": "validation_error",
  "message": "Invalid input.",
  "details": {
    "items": "Products {99} not found or unavailable."
  }
}
```

### POST /api/v1/orders/ — Error 429

```json
{
  "error": "throttled",
  "message": "Request was throttled. Expected available in 45 seconds."
}
```

### GET /api/v1/catalog/{slug}/menu/ — Response 200

```json
{
  "categories": [
    {
      "id": 1,
      "name": "Tacos",
      "sort_order": 0,
      "products": [
        {
          "id": 5,
          "name": "Taco al Pastor",
          "description": "Pork with pineapple",
          "photo_url": "https://bucket.s3.amazonaws.com/...",
          "base_price": "15000.00",
          "ingredients": "Pork, pineapple, cilantro, onion",
          "is_available": true,
          "toppings": [
            {"id": 3, "name": "Extra cheese", "additional_price": "3000.00"}
          ]
        }
      ]
    }
  ]
}
```

## Data Models

This module reuses all models from `restaurant-admin` without modifications:

- `restaurants.Restaurant` — identified by `slug` in public endpoints
- `restaurants.WhiteLabelConfig` — applied for branding on the public page
- `catalog.Category`, `catalog.Product`, `catalog.Topping` — menu structure
- `orders.Order`, `orders.OrderItem`, `orders.OrderItemTopping` — order persistence

### Model Additions

The `Order` model's `DeliveryType` choices are extended to include `dine_in`:

```python
class DeliveryType(models.TextChoices):
    PICKUP = "pickup"
    DELIVERY = "delivery"
    DINE_IN = "dine_in"
```

No new models are introduced.

## Error Handling

### Order Submission Errors

| Condition | HTTP Status | Error Code | Description |
|-----------|-------------|------------|-------------|
| Invalid/missing fields | 400 | `validation_error` | Standard DRF validation |
| Restaurant slug not found | 400 | `validation_error` | Slug does not match any restaurant |
| Product not in restaurant | 400 | `validation_error` | Product ID belongs to another restaurant |
| Product unavailable | 400 | `validation_error` | Product exists but `is_available=False` |
| Topping not on product | 400 | `validation_error` | Topping ID doesn't belong to the specified product |
| Rate limit exceeded | 429 | `throttled` | Too many requests from same IP |
| Telegram send fails | — | — | Logged server-side; client receives 201 success |

### Frontend Error States

- **404 page**: Displayed when slug does not resolve to a restaurant
- **Validation highlights**: Missing required fields are highlighted with error messages
- **Network error**: Toast notification with retry suggestion
- **Order failure**: Error modal with option to retry submission

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Public menu endpoint returns structured category data

*For any* valid restaurant slug with at least one category and product, the public menu endpoint SHALL return all categories with their associated products and toppings nested within, grouped by category and sorted by `sort_order`.

**Validates: Requirements 1.1, 2.1**

### Property 2: Invalid slug returns 404

*For any* string that does not correspond to an existing restaurant slug, the public restaurant endpoint SHALL return HTTP 404.

**Validates: Requirements 1.2**

### Property 3: Public endpoints require no authentication

*For any* valid restaurant slug, requests to the public menu endpoint and the order creation endpoint without an Authorization header SHALL succeed (200 or 201 respectively), never returning 401.

**Validates: Requirements 1.4, 7.2**

### Property 4: Cart addition preserves item data

*For any* product with any combination of toppings and special instructions, adding it to the cart SHALL create a new independent cart entry that preserves the product_id, product_name, base_price, quantity, all selected toppings, and the special instructions text exactly as provided.

**Validates: Requirements 3.4, 3.6**

### Property 5: Cart total equals sum of item costs

*For any* set of cart items, the computed cart subtotal SHALL equal the sum of `(base_price + sum(topping.additional_price)) * quantity` for each item; and the order total SHALL equal the subtotal plus the delivery fee (when delivery type is "delivery") or subtotal alone (otherwise).

**Validates: Requirements 2.4, 5.2**

### Property 6: Cart clear resets to empty state

*For any* non-empty cart state, calling `clearCart()` SHALL result in a cart with zero items and a total item count of zero.

**Validates: Requirements 2.6**

### Property 7: Address validation rejects incomplete delivery addresses

*For any* address form submission where delivery type is "delivery" and at least one of the mandatory fields (street_type, road_number, cross_number, building_number, neighborhood, city) is empty or whitespace-only, the validation function SHALL return invalid and identify exactly which fields are missing.

**Validates: Requirements 4.5**

### Property 8: Order persistence round-trip

*For any* valid order submission payload, creating the order via POST and then querying the created order from the database SHALL return matching values for all items (product_name, quantity, unit_price), all item toppings (topping_name, additional_price), delivery_type, delivery_address, payment_method, customer_name, and total.

**Validates: Requirements 6.1**

### Property 9: Telegram message contains all required order details

*For any* persisted order, the formatted Telegram message SHALL contain the item list with product names, quantities, and topping names; the delivery type; the delivery address (when applicable); the payment method; and the total amount.

**Validates: Requirements 6.3**

### Property 10: Pagination structure on list responses

*For any* list endpoint response containing more items than the configured page size, the response SHALL include `count` (total number of items), `next` (URL to next page or null), and `previous` (URL to previous page or null), and the number of items in `results` SHALL not exceed the page size.

**Validates: Requirements 7.4**

### Property 11: Product-restaurant ownership validation

*For any* order submission referencing at least one product_id that does not belong to the restaurant identified by the slug, the API SHALL reject the request with HTTP 400 and SHALL NOT persist any order or order items.

**Validates: Requirements 7.5**
