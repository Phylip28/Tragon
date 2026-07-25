# Requirements Document

## Introduction

The client-ordering module handles the customer-facing flow: browsing the restaurant menu, selecting products with toppings, choosing delivery type and payment method, and confirming an order. It depends on the restaurant-admin module being functional (restaurant with products must exist). Order statuses: `received`, `confirmed`, `in_preparation`, `completed`, `cancelled`.

## Glossary

- **Client**: End user who places an order through the menu interface.
- **Menu**: Set of categories and products available for a restaurant.
- **Order**: A text entry containing food/drink items with quantities, delivery type, and payment method.
- **Cart**: Temporary client-side collection of items before order confirmation.

## Requirements

### Requirement 1: Menu Browsing

**User Story:** As a client, I want to see the restaurant menu organized by categories with photos and names, so that I can explore and select the products I want to order.

#### Acceptance Criteria

1. WHEN the client accesses the frontend with a valid restaurant slug, THE frontend SHALL display the menu separated by categories.
2. THE frontend SHALL show each product with its photo and name within its category.
3. WHEN the client taps a product photo or name, THE frontend SHALL navigate to the product detail view.
4. WHILE the client has at least one item in the cart, THE frontend SHALL display the total item count at the bottom of the screen.
5. THE frontend SHALL display "Cancel order" and "Pay" buttons at the bottom during menu navigation.
6. WHEN the client presses "Cancel order", THE frontend SHALL clear all cart items and return to the initial menu state.

### Requirement 2: Product Detail

**User Story:** As a client, I want to see product details with ingredients, toppings, and a special instructions field, so that I can customize my order before adding it.

#### Acceptance Criteria

1. WHEN the frontend shows the product detail, THE frontend SHALL display the photo, name, and ingredients of the selected product.
2. THE frontend SHALL show all available toppings with their additional prices.
3. THE frontend SHALL show a free-text field for special instructions.
4. WHEN the client presses "Accept", THE frontend SHALL add the item to the cart with selected toppings and instructions, then return to the main menu.
5. WHEN the client presses "Cancel", THE frontend SHALL discard changes and return to the main menu without modifying the cart.
6. THE frontend SHALL allow adding the same product multiple times with different toppings and instructions, creating an independent cart item each time.

### Requirement 3: Delivery Type Selection

**User Story:** As a client, I want to indicate how I want to receive my order, so that the restaurant can process it correctly.

#### Acceptance Criteria

1. WHEN the client presses "Pay", THE frontend SHALL show delivery type options: delivery, pickup, and dine-in.
2. WHEN the client selects "delivery", THE frontend SHALL show an address form adapted for Colombian address format.
3. THE address form SHALL include fields: street type, road number, cross number, building number, neighborhood, city, and additional details.
4. WHEN the client selects "pickup" or "dine-in", THE frontend SHALL show the restaurant address and a mini map with its location.
5. IF the client selects "delivery" and does not complete mandatory address fields, THEN THE frontend SHALL block advancement and highlight the missing fields.

### Requirement 4: Payment Method

**User Story:** As a client, I want to choose between cash or bank transfer payment, so that I can complete my order with my preferred method.

#### Acceptance Criteria

1. WHEN the client advances from delivery type selection, THE frontend SHALL show a modal with payment options: cash and transfer.
2. WHEN the client selects "cash", THE frontend SHALL show the order total, delivery fee (if applicable), and a field for the bill denomination.
3. WHEN the client selects "transfer", THE frontend SHALL show the restaurant's Bre-b key, total amount, delivery fee (if applicable), and instructions to send the receipt via chat.
4. WHEN the frontend shows the Bre-b key, THE frontend SHALL include a button that copies the key to the clipboard.
5. IF the client selects "cash" and does not enter the bill denomination, THEN THE frontend SHALL block order confirmation and highlight the missing field.

### Requirement 5: Order Confirmation

**User Story:** As a client, I want to confirm my order so that the restaurant receives it with all details.

#### Acceptance Criteria

1. WHEN the client confirms the order, THE backend SHALL persist the order in the database with all items, toppings, special instructions, delivery type, address data (if applicable), and payment method.
2. WHEN the backend persists the order, THE backend SHALL send a notification to the restaurant chat with the complete order details.
3. THE notification SHALL include: item list with toppings and instructions, delivery type, address if applicable, payment method, and total.
4. IF the notification delivery fails, THEN THE backend SHALL log the error and return a success response to the frontend since the order was already persisted.
5. WHEN the order is confirmed successfully, THE frontend SHALL show a confirmation screen with the order summary and reference number.
