# Requirements Document

## Introduction

The restaurant-admin module provides restaurant owners with tools to configure their restaurant profile (generate a unique slug identifier, upload images), manage their menu (categories, products, toppings), and view order history.

## Glossary

- **Restaurant**: Business entity identified by a unique slug that uses the system to manage its menu and receive orders.
- **Slug**: Unique, short, immutable identifier associated with a restaurant.
- **Product**: Menu item belonging to a category with name, description, photo, base price, and optional toppings.
- **Management Panel**: Frontend section restricted to the restaurant for administering its menu and configuration.

## Requirements

### Requirement 1: Restaurant Profile Configuration

**User Story:** As a restaurant owner, I want to register and log in from the frontend, so that I can manage my restaurant without needing backend admin access.

#### Acceptance Criteria

1. THE system SHALL provide a registration form with fields: owner name, email, password, and restaurant name.
2. WHEN the owner submits the registration form, THE system SHALL create the owner account and the restaurant record, and SHALL auto-generate a unique slug based on the restaurant name.
3. THE system SHALL provide a login form with email and password fields.
4. WHEN the owner logs in successfully, THE system SHALL authenticate the session and grant access to the management panel.
5. WHILE the owner's session is active, THE system SHALL maintain authentication and automatically renew it without requiring re-login.
6. IF the session has fully expired, THEN THE system SHALL redirect the owner to the login page.

### Requirement 2: Restaurant Profile Configuration

**User Story:** As a restaurant owner, I want to configure my restaurant's profile, so that clients see accurate information.

#### Acceptance Criteria

1. THE system SHALL identify each restaurant by a unique and immutable slug.
2. THE management panel SHALL allow editing: name, logo, address, Payment Methods, notification channel, and delivery fee.
3. IF other user without restaurant role THEN THE system not SHALL allow modify the data.

### Requirement 2: Menu Management

**User Story:** As a restaurant owner, I want to manage my menu (categories, products, toppings), so offert my products at the users.

#### Acceptance Criteria

1. THE management panel SHALL allow creating, editing, and deleting categories.
2. THE management panel SHALL allow creating, editing, and deleting products, including name, description, photo, base price, and ingredients.
3. THE management panel SHALL allow creating, editing, and deleting toppings associated with products, including name and additional price.

### Requirement 3: Image Configuration

**User Story:** As a restaurant owner, I want to upload and configure images for my restaurant logo and products, so that clients see appealing visuals.

#### Acceptance Criteria

1. THE management panel SHALL allow uploading a restaurant logo image.
2. THE management panel SHALL allow uploading a photo for each product.
3. THE frontend SHALL display uploaded images in the menu and restaurant profile.

### Requirement 4: Order History

**User Story:** As a restaurant owner, I want to view the history of orders received and the state of thisone, so that I can track sales and review past orders.

#### Acceptance Criteria

1. THE management panel SHALL display a list of past orders for the restaurant.
2. THE order history SHALL show: reference number, date and hour, items summary, total, delivery type, and state.
3. THE management panel SHALL allow filtering order history by date range and state.

### Requirement 5: Menu Ordering and Sections

**User Story:** As a restaurant owner, I want to reorder my products by dragging them and group them into custom sections (e.g. "Más pedidos", "Para chuparse los dedos", "Solo pollo"), so that I can highlight my best items and organize my menu the way I want.

#### Acceptance Criteria

1. THE management panel SHALL allow the owner to reorder products by dragging them into a new position.
2. THE management panel SHALL allow the owner to create, rename, and delete custom menu sections.
3. THE management panel SHALL allow the owner to assign products to one or more sections.
4. WHEN the owner reorders products or sections, THE frontend SHALL persist the new order and reflect it in the client-facing menu.
