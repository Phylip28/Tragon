# Design Document

## Overview

The restaurant-admin module provides the backend API and frontend management panel for restaurant owners to configure their restaurant, manage menus, and view order history. It enforces multi-tenant isolation so each restaurant's data is accessible only through its own authentication context.

## Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Astro 7.x SSR + React Islands (Management Panel)          │
│  - Restaurant config & settings                             │
│  - Menu management (categories, products, toppings)         │
│  - Order history dashboard                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────────┐
│  Django REST Framework API                                   │
│  - apps/restaurants → profile, slug, config                 │
│  - apps/catalog    → categories, products, toppings         │
│  - apps/orders     → order list, status transitions         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  PostgreSQL │ AWS S3 (images)                                │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### API Endpoints

All API endpoints are served under `/api/v1/`.

#### Restaurant Endpoints

| Method | Path                                 | Description                |
| ------ | ------------------------------------ | -------------------------- |
| GET    | `/api/v1/restaurants/me/`            | Get own restaurant profile |
| PATCH  | `/api/v1/restaurants/me/`            | Update restaurant profile  |
| GET    | `/api/v1/restaurants/{slug}/public/` | Public restaurant data     |

The `slug` field is excluded from writable fields. Any attempt to include it in PATCH payload is silently ignored.

#### Catalog Endpoints

| Method       | Path                                          | Description                |
| ------------ | --------------------------------------------- | -------------------------- |
| GET/POST     | `/api/v1/catalog/categories/`                 | List / Create categories   |
| PATCH/DELETE | `/api/v1/catalog/categories/{id}/`            | Update / Delete category   |
| GET/POST     | `/api/v1/catalog/products/`                   | List / Create products     |
| PATCH/DELETE | `/api/v1/catalog/products/{id}/`              | Update / Delete product    |
| POST         | `/api/v1/catalog/products/{id}/upload-photo/` | Upload product photo       |
| GET/POST     | `/api/v1/catalog/toppings/`                   | List / Create toppings     |
| PATCH/DELETE | `/api/v1/catalog/toppings/{id}/`              | Update / Delete topping    |
| GET          | `/api/v1/catalog/{slug}/menu/`                | Public full menu (no auth) |

#### Order Endpoints

| Method | Path                          | Description                                       |
| ------ | ----------------------------- | ------------------------------------------------- |
| GET    | `/api/v1/orders/`             | List orders (filters: status, date_from, date_to) |
| GET    | `/api/v1/orders/{id}/`        | Get order detail                                  |
| PATCH  | `/api/v1/orders/{id}/status/` | Change order status                               |

### Multi-Tenant Isolation

All catalog and order endpoints automatically filter by the restaurant associated with the authenticated owner. This is enforced at the queryset level via a shared mixin.

### Order State Machine

Valid transitions:

- `received` → `confirmed`, `cancelled`
- `confirmed` → `in_preparation`, `cancelled`
- `in_preparation` → `completed`, `cancelled`
- `completed` → (terminal)
- `cancelled` → (terminal)

Invalid transitions return HTTP 409.

## Data Models

Refer to `DATABASE.md` at the project root for the canonical normalized schema. This design document references those tables for context but `DATABASE.md` is the source of truth.

Key models used by this module:

- `restaurant` — profile, slug, delivery fee, telegram chat ID
- `payment_method` — per-restaurant payment method catalog
- `category` — menu categories scoped to a restaurant
- `product` — menu items with price, photo, description
- `topping` — optional add-ons per product
- `order` — customer orders with status, delivery info, payment reference
- `order_item` — line items referencing products with price at order time
- `order_item_topping` — toppings per order item with price at order time

## Error Handling

All API errors follow a consistent JSON format:

| Code                 | HTTP Status | Description                                              |
| -------------------- | ----------- | -------------------------------------------------------- |
| `validation_error`   | 400         | Request body validation failed                           |
| `not_found`          | 404         | Resource does not exist or belongs to another restaurant |
| `invalid_transition` | 409         | Order status transition not allowed                      |
| `upload_failed`      | 500         | S3 upload failed                                         |
