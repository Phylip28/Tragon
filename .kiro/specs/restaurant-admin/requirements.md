# Requirements Document

## Introduction

The restaurant-admin module provides restaurant owners with tools to register, authenticate, configure their restaurant profile, manage their menu (categories, products, toppings), configure payment methods, manage orders, and apply white-label branding. This is the foundational module that must be functional before clients can browse menus or place orders.

## Glossary

- **Restaurant**: Business entity identified by a unique auto-generated slug.
- **Slug**: Unique, short, non-sequential identifier automatically derived from the restaurant name.
- **Owner**: Person who registers and manages the restaurant.
- **Product**: Menu item belonging to a category with name, photo, base price, and optional toppings.
- **Management Panel**: Frontend section for authenticated restaurant owners to manage their business.
- **White Label**: Customizable branding (colors, logo, name) applied per restaurant.
- **Payment Method**: A payment option configured by the restaurant (e.g. cash, bank transfer) that clients can select when placing orders.

## Requirements

### Requirement 1: Restaurant Registration and Login

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

1. THE system SHALL identify each restaurant by a unique and immutable auto-generated slug.
2. THE management panel SHALL allow editing: name, logo, address, delivery fee, and contact information.
3. WHEN the owner saves profile changes, THE system SHALL persist all modifications and return them accurately on subsequent reads.
4. IF an attempt is made to modify the restaurant slug, THEN THE system SHALL reject or ignore the change, preserving the original slug.

### Requirement 3: White Label Branding

**User Story:** As a restaurant owner, I want to customize the visual branding of my ordering page, so that it reflects my restaurant's identity.

#### Acceptance Criteria

1. THE management panel SHALL allow configuring: primary color, secondary color, logo, and restaurant display name.
2. WHEN a client accesses the restaurant's menu URL, THE system SHALL apply the restaurant's white-label configuration to the interface.
3. WHEN the owner saves white-label changes, THE system SHALL persist the configuration per restaurant and return it with the menu data.

### Requirement 4: Menu Management

**User Story:** As a restaurant owner, I want to manage my menu (categories, products, toppings) from the frontend, so that I can update offerings autonomously.

#### Acceptance Criteria

1. THE management panel SHALL allow creating, editing, and deleting categories.
2. THE management panel SHALL allow creating, editing, and deleting products, including name, photo, base price, and ingredients.
3. THE management panel SHALL allow creating, editing, and deleting toppings associated with products, including name and additional price.
4. WHEN the owner uploads a product photo, THE system SHALL store the image and return an accessible URL.
5. THE system SHALL protect all menu management operations behind owner authentication.

### Requirement 5: Payment Method Configuration

**User Story:** As a restaurant owner, I want to configure which payment methods are available for my clients, so that I can control how they pay for orders.

#### Acceptance Criteria

1. THE management panel SHALL allow the owner to create, edit, and deactivate payment methods for their restaurant.
2. EACH payment method SHALL have: a type (cash, bank transfer, or other), a display name, and optional configuration data (e.g. transfer key for bank payments).
3. THE system SHALL allow multiple active payment methods per restaurant.
4. WHEN a client views the payment options during checkout, THE system SHALL display only the active payment methods configured for that restaurant.
5. IF a payment method has been used in existing orders, THEN THE system SHALL only allow deactivation, not deletion.

### Requirement 6: Order Management

**User Story:** As a restaurant owner, I want to view and manage orders from the frontend panel, so that I can track and process customer orders.

#### Acceptance Criteria

1. THE management panel SHALL display incoming orders in real time.
2. THE management panel SHALL allow changing order status following the sequence: received → confirmed → in_preparation → completed.
3. THE management panel SHALL allow cancelling orders that have not yet been completed.
4. THE management panel SHALL display order history with filters by date range and status.
5. THE order list SHALL show: reference number, date, items summary, total, delivery type, payment method, and status.

### Requirement 7: Multi-Restaurant Isolation

**User Story:** As a system operator, I want each restaurant's data to be isolated, so that no restaurant can access another's data.

#### Acceptance Criteria

1. THE system SHALL ensure that menu, products, orders, payment methods, and configurations of one restaurant are not accessible from another restaurant's authentication context.
2. THE system SHALL filter all resources automatically by the restaurant associated with the authenticated owner.
3. ALL database records SHALL include creation and last-update timestamps.
