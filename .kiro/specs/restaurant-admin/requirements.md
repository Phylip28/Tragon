# Requirements Document — Restaurant Admin

## Introduction

The restaurant-admin module provides restaurant owners with tools to register, authenticate, configure their restaurant profile, manage their menu (categories, products, toppings), manage orders, and apply white-label branding. This is the foundational module that must be functional before clients can browse menus or place orders.

Authentication is via JWT using Simple JWT. The restaurant slug is auto-generated from the restaurant name.

## Glossary

- **Restaurant**: Business entity identified by a unique auto-generated slug.
- **Slug**: Unique, short, non-sequential identifier automatically derived from the restaurant name.
- **Owner**: Person who registers and manages the restaurant.
- **Product**: Menu item belonging to a category with name, photo, base price, and optional toppings.
- **Management Panel**: Frontend section for authenticated restaurant owners to manage their business.
- **White Label**: Customizable branding (colors, logo, name) applied per restaurant.
- **JWT**: JSON Web Token used for restaurant owner authentication via Simple JWT.

## Requirements

### Requirement 1: Restaurant Registration and Login

**User Story:** As a restaurant owner, I want to register and log in from the frontend, so that I can manage my restaurant without needing Django Admin access.

#### Acceptance Criteria

1. THE frontend SHALL provide a registration form with fields: owner name, email, password, and restaurant name.
2. WHEN the owner submits the registration form, THE backend SHALL create the owner account and the restaurant record, and SHALL auto-generate a unique slug based on the restaurant name.
3. THE frontend SHALL provide a login form with email and password fields.
4. WHEN the owner logs in successfully, THE backend SHALL return a JWT access token and a refresh token using Simple JWT.
5. THE frontend SHALL store the JWT tokens securely and use the access token for all authenticated API requests.
6. WHEN the access token expires, THE frontend SHALL automatically request a new one using the refresh token without requiring re-login.
7. IF the refresh token is also expired, THEN THE frontend SHALL redirect the owner to the login page.

### Requirement 2: Restaurant Profile Configuration

**User Story:** As a restaurant owner, I want to configure my restaurant's profile, so that clients see accurate information.

#### Acceptance Criteria

1. THE backend SHALL identify each restaurant by a unique and immutable auto-generated slug.
2. THE management panel SHALL allow editing: name, logo, address, Bre-b key, delivery fee, and contact information.
3. THE backend SHALL persist all configuration changes and return them accurately on subsequent reads.
4. IF an attempt is made to modify the restaurant slug via API, THEN THE backend SHALL reject or ignore the change, preserving the original slug.

### Requirement 3: White Label Branding

**User Story:** As a restaurant owner, I want to customize the visual branding of my ordering page, so that it reflects my restaurant's identity.

#### Acceptance Criteria

1. THE management panel SHALL allow configuring: primary color, secondary color, logo, and restaurant display name.
2. WHEN a client accesses the restaurant's menu URL, THE frontend SHALL apply the restaurant's white-label configuration to the interface.
3. THE backend SHALL store white-label configuration per restaurant and return it with the menu data.

### Requirement 4: Menu Management

**User Story:** As a restaurant owner, I want to manage my menu (categories, products, toppings) from the frontend, so that I can update offerings autonomously.

#### Acceptance Criteria

1. THE management panel SHALL allow creating, editing, and deleting categories.
2. THE management panel SHALL allow creating, editing, and deleting products, including name, photo, base price, and ingredients.
3. THE management panel SHALL allow creating, editing, and deleting toppings associated with products, including name and additional price.
4. WHEN the owner uploads a product photo, THE backend SHALL store the image in S3 and return an accessible URL.
5. THE backend SHALL expose JWT-protected API endpoints for all menu management operations.

### Requirement 5: Order Management

**User Story:** As a restaurant owner, I want to view and manage orders from the frontend panel, so that I can track and process customer orders.

#### Acceptance Criteria

1. THE management panel SHALL display incoming orders in real time.
2. THE management panel SHALL allow changing order status: received → confirmed → in_preparation → completed.
3. THE management panel SHALL allow cancelling orders.
4. THE management panel SHALL display order history with filters by date range and status.
5. THE order list SHALL show: reference number, date, items summary, total, delivery type, payment method, and status.

### Requirement 6: Multi-Restaurant Isolation

**User Story:** As a system operator, I want each restaurant's data to be isolated, so that no restaurant can access another's data.

#### Acceptance Criteria

1. THE backend SHALL ensure that menu, products, orders, and configurations of one restaurant are not accessible from another restaurant's authentication context.
2. THE API SHALL filter all resources automatically by the restaurant associated with the authenticated JWT.
3. THE backend SHALL use integer primary keys for all database tables.
4. ALL database tables SHALL include `created_at` and `updated_at` timestamp fields.
