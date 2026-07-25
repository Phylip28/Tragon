# Requirements Document — Client Ordering

## Introduction

The client-ordering module handles the customer-facing flow: browsing the restaurant menu via a shareable URL, selecting products with toppings, choosing delivery type and payment method, and confirming an order. The restaurant manually shares its URL (e.g. `tragones.com/{restaurant_slug}`) with the client via Telegram or WhatsApp chat. No automated bot is involved.

Depends on: restaurant-admin module (restaurant with products must exist).

## Glossary

- **Client**: End user who places an order through the menu interface.
- **Restaurant Slug**: Unique, auto-generated identifier based on the restaurant name. Used in the public URL.
- **Menu**: Set of categories and products available for a restaurant.
- **Cart**: Temporary client-side collection of items before order confirmation.
- **Order**: Persisted record containing items with toppings, delivery type, address, and payment method.
- **Bre-b**: Colombian bank transfer payment system.

## Requirements

### Requirement 1: Menu Access via Shared URL

**User Story:** As a client, I want to access the restaurant menu by clicking a link shared in chat, so that I can browse and order food.

#### Acceptance Criteria

1. WHEN the client navigates to `/{restaurant_slug}`, THE frontend SHALL validate the slug against the backend and display the restaurant menu.
2. IF the slug does not exist, THEN THE frontend SHALL display a 404 error page.
3. THE URL SHALL use the restaurant's auto-generated slug (derived from restaurant name, short, non-sequential).
4. THE frontend SHALL NOT require any login or authentication from the client to browse the menu.

### Requirement 2: Menu Browsing

**User Story:** As a client, I want to see the restaurant menu organized by categories with photos and names, so that I can explore and select the products I want to order.

#### Acceptance Criteria

1. WHEN the client accesses the frontend with a valid restaurant slug, THE frontend SHALL display the menu separated by categories.
2. THE frontend SHALL show each product with its photo and name within its category.
3. WHEN the client taps a product photo or name, THE frontend SHALL navigate to the product detail view.
4. WHILE the client has at least one item in the cart, THE frontend SHALL display the total item count at the bottom of the screen.
5. THE frontend SHALL display "Cancel order" and "Pay" buttons at the bottom during menu navigation.
6. WHEN the client presses "Cancel order", THE frontend SHALL clear all cart items and return to the initial menu state.

### Requirement 3: Product Detail

**User Story:** As a client, I want to see product details with ingredients, toppings, and a special instructions field, so that I can customize my order before adding it.

#### Acceptance Criteria

1. WHEN the frontend shows the product detail, THE frontend SHALL display the photo, name, and ingredients of the selected product.
2. THE frontend SHALL show all available toppings with their additional prices.
3. THE frontend SHALL show a free-text field for special instructions (e.g. "no onion", "well done").
4. WHEN the client presses "Accept", THE frontend SHALL add the item to the cart with selected toppings and instructions, then return to the main menu.
5. WHEN the client presses "Cancel", THE frontend SHALL discard changes and return to the main menu without modifying the cart.
6. THE frontend SHALL allow adding the same product multiple times with different toppings and instructions, creating an independent cart item each time.

### Requirement 4: Delivery Type Selection

**User Story:** As a client, I want to indicate how I want to receive my order, so that the restaurant can process it correctly.

#### Acceptance Criteria

1. WHEN the client presses "Pay", THE frontend SHALL show delivery type options: delivery, pickup, and dine-in.
2. WHEN the client selects "delivery", THE frontend SHALL show an address form adapted for Colombian address format.
3. THE address form SHALL include fields: street type, road number, cross number, building number, neighborhood, city, and additional details.
4. WHEN the client selects "pickup" or "dine-in", THE frontend SHALL show the restaurant address and a mini map with its location.
5. IF the client selects "delivery" and does not complete mandatory address fields, THEN THE frontend SHALL block advancement and highlight the missing fields.

### Requirement 5: Payment Method

**User Story:** As a client, I want to choose between cash or bank transfer payment, so that I can complete my order with my preferred method.

#### Acceptance Criteria

1. WHEN the client advances from delivery type selection, THE frontend SHALL show a modal with payment options: cash and transfer.
2. WHEN the client selects "cash", THE frontend SHALL show the order total, delivery fee separated (if applicable), and a field for the bill denomination the client will pay with.
3. WHEN the client selects "transfer", THE frontend SHALL show the restaurant's Bre-b key, total amount, delivery fee (if applicable), and instructions to send the payment receipt via Telegram/WhatsApp chat.
4. WHEN the frontend shows the Bre-b key, THE frontend SHALL include a discreet button that copies the key to the clipboard.
5. IF the client selects "cash" and does not enter the bill denomination, THEN THE frontend SHALL block order confirmation and highlight the missing field.

### Requirement 6: Order Confirmation

**User Story:** As a client, I want to confirm my order so that the restaurant receives it with all details.

#### Acceptance Criteria

1. WHEN the client confirms the order, THE backend SHALL persist the order in PostgreSQL with all items, toppings, special instructions, delivery type, address data (if applicable), and payment method.
2. WHEN the backend persists the order, THE backend SHALL send the complete order details as a message to the client's Telegram chat.
3. THE message SHALL include: item list with toppings and instructions, delivery type, address if applicable, payment method, and total.
4. IF the message delivery fails, THEN THE backend SHALL log the error and return a success response to the frontend since the order was already persisted.
5. WHEN the order is confirmed successfully, THE frontend SHALL show a confirmation screen with the order summary and reference number.

### Requirement 7: Backend API for Orders

**User Story:** As a developer, I want a well-defined REST API for order management, so that the frontend can submit and query orders securely.

#### Acceptance Criteria

1. THE API SHALL authenticate restaurant management endpoints using JWT (Simple JWT).
2. THE API SHALL allow unauthenticated clients to submit orders via `POST /api/v1/orders/` using only the restaurant slug for identification.
3. THE API SHALL apply throttling to prevent abuse, with configurable rate limits.
4. THE API SHALL return paginated list responses with `count`, `next`, and `previous` fields.
5. WHEN the frontend submits an order, THE API SHALL validate that all referenced products belong to the restaurant identified by the slug.
6. IF validation fails, THEN THE API SHALL return HTTP 400 with a descriptive error message.
