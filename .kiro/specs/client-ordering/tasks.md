# Implementation Plan: Client Ordering

## Overview

Public-facing ordering module that allows clients to browse a restaurant menu via `/{slug}/`, build a cart, select delivery/payment options, and submit an order. Backend adds a single unauthenticated POST endpoint with throttling and Telegram notifications. Frontend uses Astro SSR with React islands and nanostores for cart state.

**Branch range:** TRA-20 through TRA-27

## Tasks

- [ ] 1. Backend: Add `dine_in` delivery type and public order endpoint
  - [ ] 1.1 Extend `DeliveryType` choices on the Order model to include `dine_in`, generate and apply migration
    - Add `DINE_IN = "dine_in"` to `Order.DeliveryType` in `apps/orders/models.py`
    - Run `python manage.py makemigrations orders` and apply
    - _Requirements: 4.1, 7.2_

  - [ ] 1.2 Create `PublicOrderCreateSerializer` in `apps/orders/serializers.py`
    - Implement nested serializers: `OrderItemToppingCreateSerializer`, `OrderItemCreateSerializer`, `PublicOrderCreateSerializer`
    - Validate restaurant slug, product ownership, topping ownership, address fields for delivery, bill_denomination for cash
    - Compute total (base_price + toppings) * quantity + delivery fee
    - Persist Order, OrderItem, OrderItemTopping in `create()`
    - Generate reference_number with `secrets.token_hex(5).upper()`
    - _Requirements: 6.1, 7.2, 7.5, 7.6_

  - [ ] 1.3 Create `create_public_order` view with `OrderCreateThrottle` in `apps/orders/views.py`
    - Function-based view with `@api_view(["POST"])`, `@permission_classes([AllowAny])`, `@throttle_classes([OrderCreateThrottle])`
    - `OrderCreateThrottle` extends `AnonRateThrottle` with `rate = "10/minute"`
    - Return 201 with `order_id` and `reference_number`
    - _Requirements: 7.2, 7.3_

  - [ ] 1.4 Register the public order endpoint in URL configuration
    - Add `path("", create_public_order, name="create-public-order")` to `apps/orders/urls.py`
    - Ensure it maps to `POST /api/v1/orders/`
    - _Requirements: 7.2_

  - [ ] 1.5 Add throttle rate and `TELEGRAM_BOT_TOKEN` to Django settings
    - Add `"anon": "10/minute"` to `DEFAULT_THROTTLE_RATES` in `config/settings/base.py`
    - Add `TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN", default="")`
    - _Requirements: 7.3_

  - [ ]* 1.6 Write unit tests for `PublicOrderCreateSerializer` validation logic
    - Test valid order creation, invalid slug, products not in restaurant, unavailable products, toppings not on product, missing address for delivery, missing bill_denomination for cash
    - _Requirements: 7.5, 7.6_

- [ ] 2. Backend: Telegram notification service
  - [ ] 2.1 Create `apps/notifications/` Django app with `services.py`
    - Implement `format_order_message(order)` — builds Markdown-formatted message with items, toppings, delivery type, address, payment, total
    - Implement `send_order_telegram_notification(order)` — fire-and-forget using `python-telegram-bot==22.2`, logs errors without raising
    - Add `python-telegram-bot==22.2` to requirements
    - _Requirements: 6.2, 6.3, 6.4_

  - [ ] 2.2 Wire Telegram notification into `create_public_order` view
    - Call `send_order_telegram_notification(order)` after successful serializer save
    - _Requirements: 6.2_

  - [ ]* 2.3 Write unit tests for Telegram service (mocked bot)
    - Test `format_order_message` output contains required fields
    - Test `send_order_telegram_notification` handles missing chat_id gracefully
    - Test error logging on TelegramError
    - _Requirements: 6.3, 6.4_

- [ ] 3. Checkpoint — Backend verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Frontend: Astro SSR page and menu display
  - [ ] 4.1 Create `src/pages/[slug]/index.astro` with SSR data fetching
    - Fetch restaurant data from `/api/v1/restaurants/{slug}/public/`
    - Fetch menu from `/api/v1/catalog/{slug}/menu/`
    - Redirect to 404 if restaurant not found
    - Apply white-label CSS variables (primary_color, secondary_color)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 4.2 Create `MenuPage` React component with category sections and product cards
    - Render restaurant header with logo and display_name
    - Render `CategorySection` for each category (heading + product grid)
    - Render `ProductCard` components (photo + name, tap to open detail)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 4.3 Create `ProductDetail` modal component
    - Display photo, name, ingredients, toppings with checkboxes and prices, special instructions textarea
    - "Accept" button adds item to cart and closes modal
    - "Cancel" button discards and closes modal
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 5. Frontend: Cart store with nanostores
  - [ ] 5.1 Create `src/stores/cart.ts` with nanostores atoms and computed values
    - Define `CartItem` and `CartItemTopping` interfaces
    - Implement `$cartItems` atom, `$cartItemCount` computed, `$cartSubtotal` computed
    - Implement `addToCart`, `removeFromCart`, `clearCart` functions
    - _Requirements: 2.4, 2.5, 2.6, 3.4, 3.6_

  - [ ] 5.2 Create `OrderBar` component (fixed bottom bar)
    - Show total item count badge from `$cartItemCount`
    - "Cancel order" button calls `clearCart()`
    - "Pay" button opens checkout flow
    - _Requirements: 2.4, 2.5, 2.6_

  - [ ]* 5.3 Write property tests for cart store logic
    - **Property 4: Cart addition preserves item data**
    - **Property 5: Cart total equals sum of item costs**
    - **Property 6: Cart clear resets to empty state**
    - **Validates: Requirements 2.4, 2.6, 3.4, 3.6**

- [ ] 6. Frontend: Checkout flow (delivery, address, payment, confirmation)
  - [ ] 6.1 Create `DeliveryTypeStep` component
    - Radio options: delivery, pickup, dine-in
    - Show `AddressForm` when delivery selected
    - Show restaurant address for pickup/dine-in
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ] 6.2 Create `AddressForm` component with Colombian address fields
    - Fields: street_type (select: Calle, Carrera, Avenida, Transversal, Diagonal), road_number, cross_number, building_number, neighborhood, city, address_details (optional)
    - Implement `validateAddress()` in `src/lib/validation.ts`
    - Block advancement and highlight missing fields when incomplete
    - _Requirements: 4.2, 4.3, 4.5_

  - [ ] 6.3 Create `PaymentMethodStep` component
    - Radio options: cash, transfer
    - Cash: show subtotal, delivery fee, total, bill_denomination input (required)
    - Transfer: show Bre-b key, amounts, instructions, copy-to-clipboard button
    - Block confirmation if cash selected without bill_denomination
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 6.4 Create `src/lib/pricing.ts` with `computeOrderTotal` function
    - Compute subtotal from cart items (base_price + toppings) * quantity
    - Add delivery fee only when delivery_type is "delivery"
    - Return `{ subtotal, delivery_fee, total }`
    - _Requirements: 5.2_

  - [ ] 6.5 Create `ConfirmationScreen` component and order submission logic
    - Submit POST to `/api/v1/orders/` with full payload
    - Display order reference number, item summary, delivery info, payment, total on success
    - Handle network errors with toast and retry option
    - Handle validation errors with error modal
    - _Requirements: 6.1, 6.5_

  - [ ]* 6.6 Write property tests for address validation and pricing
    - **Property 7: Address validation rejects incomplete delivery addresses**
    - **Validates: Requirements 4.5**
    - **Property 5: Cart total equals sum of item costs (pricing module)**
    - **Validates: Requirements 2.4, 5.2**

- [ ] 7. Checkpoint — Frontend verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Integration and wiring
  - [ ] 8.1 Wire `MenuPage` to use `ProductDetail`, `OrderBar`, and checkout flow as a unified experience
    - Connect product tap → ProductDetail modal → addToCart → OrderBar update
    - Connect Pay button → DeliveryTypeStep → AddressForm → PaymentMethodStep → submit → ConfirmationScreen
    - _Requirements: 2.3, 2.5, 3.4, 4.1, 5.1, 6.5_

  - [ ]* 8.2 Write property tests for backend order persistence round-trip
    - **Property 8: Order persistence round-trip**
    - **Validates: Requirements 6.1**
    - **Property 11: Product-restaurant ownership validation**
    - **Validates: Requirements 7.5**

  - [ ]* 8.3 Write property tests for Telegram message formatting
    - **Property 9: Telegram message contains all required order details**
    - **Validates: Requirements 6.3**

  - [ ]* 8.4 Write integration tests for public endpoints (no auth, throttle, 404)
    - **Property 3: Public endpoints require no authentication**
    - **Validates: Requirements 1.4, 7.2**
    - Test throttle returns 429 after rate limit exceeded
    - Test invalid slug returns 404
    - _Requirements: 7.3_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Branch naming: `feat/TRA-20/backend-order-endpoint`, `feat/TRA-21/telegram-service`, `feat/TRA-22/frontend-menu-page`, etc.
- Dependency: restaurant-admin module must be complete before starting (models, auth, catalog endpoints)
- No auth required for any client-facing endpoint
- `python-telegram-bot==22.2` must be pinned in requirements

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.5"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.2", "1.6"] },
    { "id": 3, "tasks": ["2.3", "4.1", "5.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "5.2", "5.3", "6.4"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "6.5", "6.6"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4"] }
  ]
}
```
