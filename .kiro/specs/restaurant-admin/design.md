# Design Document

## Overview

The restaurant-admin module covers the backend API and frontend panel for restaurant owners to configure their profile, manage their menu catalog (categories, products, toppings), organize products into custom sections with drag-and-drop ordering, upload images, and view order history. Protected by JWT + restaurant owner role.

## Architecture

This module lives within the monolith described in `ARCHITECTURE.md`. It touches:

- **Backend**: `apps/restaurants/` (profile, payment methods) + `apps/catalog/` (categories, products, toppings, sections)
- **Frontend**: `/admin/*` Astro pages with React islands for the management panel
- **Storage**: S3 for logo and product images
- **Database**: Tables `restaurant`, `payment_method`, `category`, `product`, `topping` (see `DATABASE.md`)

## Components and Interfaces

### API Endpoints

All endpoints require JWT with `restaurant_owner` role unless noted otherwise.

#### Restaurant Profile

| Method | Path                      | Description                                                                |
| ------ | ------------------------- | -------------------------------------------------------------------------- |
| GET    | `/api/v1/restaurants/me/` | Get authenticated restaurant profile                                       |
| PATCH  | `/api/v1/restaurants/me/` | Update profile (name, address, delivery_fee, logo_url). Slug is read-only. |

#### Payment Methods

| Method | Path                                           | Description                             |
| ------ | ---------------------------------------------- | --------------------------------------- |
| GET    | `/api/v1/restaurants/me/payment-methods/`      | List payment methods for the restaurant |
| POST   | `/api/v1/restaurants/me/payment-methods/`      | Add a payment method                    |
| PATCH  | `/api/v1/restaurants/me/payment-methods/{id}/` | Update a payment method                 |
| DELETE | `/api/v1/restaurants/me/payment-methods/{id}/` | Remove a payment method                 |

#### Categories

| Method | Path                               | Description                                |
| ------ | ---------------------------------- | ------------------------------------------ |
| GET    | `/api/v1/catalog/categories/`      | List categories for the restaurant         |
| POST   | `/api/v1/catalog/categories/`      | Create category                            |
| PATCH  | `/api/v1/catalog/categories/{id}/` | Update category                            |
| DELETE | `/api/v1/catalog/categories/{id}/` | Soft-delete category (set is_active=false) |

#### Products

| Method | Path                                          | Description                             |
| ------ | --------------------------------------------- | --------------------------------------- |
| GET    | `/api/v1/catalog/products/`                   | List products (filterable by category)  |
| POST   | `/api/v1/catalog/products/`                   | Create product                          |
| PATCH  | `/api/v1/catalog/products/{id}/`              | Update product                          |
| DELETE | `/api/v1/catalog/products/{id}/`              | Soft-delete product                     |
| POST   | `/api/v1/catalog/products/{id}/upload-photo/` | Upload product photo to S3, returns URL |

#### Toppings

| Method | Path                                      | Description                 |
| ------ | ----------------------------------------- | --------------------------- |
| GET    | `/api/v1/catalog/products/{id}/toppings/` | List toppings for a product |
| POST   | `/api/v1/catalog/products/{id}/toppings/` | Create topping              |
| PATCH  | `/api/v1/catalog/toppings/{id}/`          | Update topping              |
| DELETE | `/api/v1/catalog/toppings/{id}/`          | Soft-delete topping         |

#### Product Highlight Label

| Method | Path                                   | Description                                |
| ------ | -------------------------------------- | ------------------------------------------ |
| PATCH  | `/api/v1/catalog/products/{id}/label/` | Set or clear the product's highlight label |

#### Order History

| Method | Path                   | Description                                                               |
| ------ | ---------------------- | ------------------------------------------------------------------------- |
| GET    | `/api/v1/orders/`      | List orders for the restaurant. Filters: `status`, `date_from`, `date_to` |
| GET    | `/api/v1/orders/{id}/` | Get order detail (items, toppings, notes)                                 |

#### Image Upload

| Method | Path                                  | Description                               |
| ------ | ------------------------------------- | ----------------------------------------- |
| POST   | `/api/v1/restaurants/me/upload-logo/` | Upload restaurant logo to S3, returns URL |

### Public Endpoint (no auth)

| Method | Path                           | Description                                                                          |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------ |
| GET    | `/api/v1/catalog/{slug}/menu/` | Full menu for a restaurant (categories → products → toppings, with highlight labels) |

## Data Models

This module uses the following tables from `DATABASE.md`:

| Table                | Role in this module                                                       |
| -------------------- | ------------------------------------------------------------------------- |
| `restaurant`         | Profile data (name, slug, address, logo, delivery fee, telegram chat ID)  |
| `payment_method`     | Payment methods the restaurant accepts (cash, transfer, etc.)             |
| `category`           | Menu categories scoped to the restaurant                                  |
| `product`            | Menu items with name, description, photo, price, optional highlight label |
| `topping`            | Optional add-ons per product                                              |
| `order`              | Read-only in this module — used for order history display                 |
| `order_item`         | Read-only — line items shown in order detail                              |
| `order_item_topping` | Read-only — toppings per item shown in order detail                       |

Highlight labels are stored directly on `product.label` (nullable string). No additional tables required.

## Error Handling

| Scenario                                            | HTTP Code | Error Code             |
| --------------------------------------------------- | --------- | ---------------------- |
| Validation error (missing/invalid fields)           | 400       | `validation_error`     |
| JWT missing or invalid                              | 401       | `authentication_error` |
| User doesn't own this restaurant                    | 403       | `permission_denied`    |
| Resource not found or belongs to another restaurant | 404       | `not_found`            |
| Duplicate payment method type for same restaurant   | 409       | `duplicate_entry`      |
| S3 upload failure                                   | 500       | `upload_failed`        |
