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

**User Story:** As a restaurant owner, I want to configure my restaurant's profile (name, logo, address, payment key, delivery fee), so that clients see accurate information and can pay correctly.

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
4. THE frontend SHALL display uploaded images in the menu and restaurant profile.

### Requirement 4: Order History

**User Story:** As a restaurant owner, I want to view the history of orders received and the state of thisone, so that I can track sales and review past orders.

#### Acceptance Criteria

1. THE management panel SHALL display a list of past orders for the restaurant.
2. THE order history SHALL show: reference number, date and hour, items summary, total, delivery type, and state.
3. THE management panel SHALL allow filtering order history by date range and state.
