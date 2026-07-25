# Requirements Document

## Introduction

The restaurant-admin module provides restaurant owners with tools to configure their restaurant profile, manage their menu (categories, products, toppings), generate a unique slug identifier, upload images, and view order history. This is the foundational module that must be functional before clients can browse menus or place orders.

## Glossary

- **Restaurant**: Business entity identified by a unique slug that uses the system to manage its menu and receive orders.
- **Slug**: Unique, short, immutable identifier associated with a restaurant.
- **Product**: Menu item belonging to a category with name, photo, base price, and optional toppings.
- **Management Panel**: Frontend section restricted to the restaurant for administering its menu and configuration.

## Requirements

### Requirement 1: Restaurant Profile Configuration

**User Story:** As a restaurant owner, I want to configure my restaurant's profile (name, logo, address, payment key, delivery fee), so that clients see accurate information and can pay correctly.

#### Acceptance Criteria

1. THE backend SHALL identify each restaurant by a unique and immutable slug.
2. THE management panel SHALL allow editing: name, logo, address, Bre-b key, notification channel, and delivery fee.
3. THE backend SHALL persist all configuration changes and return them accurately on subsequent reads.
4. IF an attempt is made to modify the restaurant slug, THEN THE backend SHALL reject or ignore the change, preserving the original slug.

### Requirement 2: Slug Generation

**User Story:** As a restaurant owner, I want the system to generate a unique slug for my restaurant, so that clients can access my menu via a memorable URL.

#### Acceptance Criteria

1. WHEN a new restaurant is created, THE backend SHALL generate a unique slug that is short and non-sequential.
2. THE backend SHALL ensure no two restaurants share the same slug.
3. THE slug SHALL be used in all public-facing URLs for the restaurant.

### Requirement 3: Menu Management

**User Story:** As a restaurant owner, I want to manage my menu (categories, products, toppings) from the frontend without accessing Django Admin, so that I can update offerings autonomously.

#### Acceptance Criteria

1. THE management panel SHALL allow creating, editing, and deleting categories.
2. THE management panel SHALL allow creating, editing, and deleting products, including name, photo, base price, and ingredients.
3. THE management panel SHALL allow creating, editing, and deleting toppings associated with products, including name and additional price.
4. WHEN the owner uploads a product photo, THE backend SHALL store the image and return an accessible URL.
5. THE backend SHALL expose protected API endpoints for all menu management operations.

### Requirement 4: Image Configuration

**User Story:** As a restaurant owner, I want to upload and configure images for my restaurant logo and products, so that clients see appealing visuals.

#### Acceptance Criteria

1. THE management panel SHALL allow uploading a restaurant logo image.
2. THE management panel SHALL allow uploading a photo for each product.
3. WHEN an image is uploaded, THE backend SHALL store it in S3 and return the public URL.
4. THE frontend SHALL display uploaded images in the menu and restaurant profile.

### Requirement 5: Order History

**User Story:** As a restaurant owner, I want to view the history of orders received, so that I can track sales and review past orders.

#### Acceptance Criteria

1. THE management panel SHALL display a list of past orders for the authenticated restaurant.
2. THE order history SHALL show: reference number, date, items summary, total, delivery type, and status.
3. THE management panel SHALL allow filtering order history by date range and status.
