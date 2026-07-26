# Implementation Plan: Restaurant Admin

## Overview

Build the restaurant-admin module from scratch: Django backend (models, auth, APIs), Astro frontend (management panel), S3 image uploads, and Docker infrastructure. No test suite.

## Tasks

- [x] 1. Backend project setup
  - Create `tragon_backend/` with `pyproject.toml` (Django 5.2.x, djangorestframework, djangorestframework-simplejwt, django-cors-headers, psycopg[binary], boto3, pillow)
  - Initialize with `uv`: `uv init`, `uv sync`
  - Create `config/settings/base.py`, `development.py`, `production.py`
  - Configure `INSTALLED_APPS`, `REST_FRAMEWORK`, `SIMPLE_JWT`, `CORS`, custom exception handler
  - Create apps skeleton: `apps/restaurants/`, `apps/catalog/`, `apps/orders/`
  - Create `config/urls.py` with `/api/v1/` prefix
  - Create `Dockerfile` for the backend (Python 3.12, uv)
  - Create `docker-compose.yml` with services: `backend`, `postgres`
  - Verify: `docker-compose up` boots without errors, Django admin accessible
  - _Requirements: —_

- [ ] 2. Database models and migrations
  - [x] 2.1 Implement `Owner` model in `apps/restaurants/models.py`
    - Extend `AbstractUser`, email as `USERNAME_FIELD`, timestamps
  - [x] 2.2 Implement `Restaurant` model
    - Fields per `DATABASE.md`: slug (auto-generated, immutable), name, logo_url, address_line, lat/lng, telegram_chat_id, delivery_fee, is_active, created_at
  - [x] 2.3 Implement `PaymentMethod` model
    - FK to restaurant, type with CHECK, key_value conditional, is_active, UNIQUE(restaurant_id, type)
  - [x] 2.4 Implement `Category` model in `apps/catalog/models.py`
    - FK to restaurant (NOT NULL, ON DELETE RESTRICT), name, is_active, UNIQUE(restaurant_id, name)
  - [x] 2.5 Implement `Product` model
    - FK to category (nullable, ON DELETE SET NULL), name, description, photo_url, base_price, is_active, label
  - [x] 2.6 Implement `Topping` model
    - FK to product (NOT NULL, ON DELETE CASCADE), name, extra_price, is_active
  - [x] 2.7 Implement `Order`, `OrderItem`, `OrderItemTopping` models in `apps/orders/models.py`
    - All fields and constraints per `DATABASE.md`, including CHECK constraints on status and delivery_type
    - These are read-only in this module (used for order history)
  - [ ] 2.8 Generate and run all migrations
  - Verify: `python manage.py migrate` runs cleanly, all tables exist in postgres
  - _Requirements: R1, R2, R4_

- [ ] 3. Authentication: JWT + roles
  - Configure Simple JWT in settings (access 30min, refresh 7d, rotate+blacklist)
  - Create `RegistrationSerializer` (owner_name, email, password, restaurant_name)
  - Create `POST /api/v1/auth/register/` — creates Owner + Restaurant atomically, returns JWT pair + restaurant data with slug
  - Create `POST /api/v1/auth/token/` — login, returns JWT pair
  - Create `POST /api/v1/auth/token/refresh/` — refresh access token
  - Create `IsRestaurantOwner` permission class
  - Create `RestaurantScopedMixin` — auto-filters querysets by the authenticated owner's restaurant
  - Verify: register → login → access protected endpoint → refresh → re-access
  - _Requirements: R1.3_

- [ ] 4. Restaurant profile API
  - Create `RestaurantSerializer` (slug read-only, exclude from writable fields)
  - `GET /api/v1/restaurants/me/` — returns authenticated owner's restaurant
  - `PATCH /api/v1/restaurants/me/` — update name, address_line, delivery_fee, lat/lng. Slug change silently ignored.
  - `POST /api/v1/restaurants/me/upload-logo/` — upload file to S3, save URL in `logo_url`
  - Verify: PATCH with slug field → slug unchanged; upload logo → URL returned and stored
  - _Requirements: R1.1, R1.2, R3.1_

- [ ] 5. Payment methods API
  - Create `PaymentMethodSerializer` with validation: `key_value` required if `type = 'transfer_with_key'`
  - `GET /api/v1/restaurants/me/payment-methods/` — list for the restaurant
  - `POST /api/v1/restaurants/me/payment-methods/` — add payment method
  - `PATCH /api/v1/restaurants/me/payment-methods/{id}/` — update
  - `DELETE /api/v1/restaurants/me/payment-methods/{id}/` — remove (hard delete or is_active=false)
  - Verify: cannot create duplicate `(restaurant_id, type)`; `transfer_with_key` without `key_value` returns 400
  - _Requirements: R1.2_

- [ ] 6. Categories API
  - Create `CategorySerializer`
  - `GET /api/v1/catalog/categories/` — list (filtered by restaurant via mixin)
  - `POST /api/v1/catalog/categories/` — create
  - `PATCH /api/v1/catalog/categories/{id}/` — update name
  - `DELETE /api/v1/catalog/categories/{id}/` — soft-delete (set `is_active=false`)
  - Verify: duplicate name within same restaurant → 400; different restaurants can share names
  - _Requirements: R2.1_

- [ ] 7. Products API + photo upload + highlight label
  - Create `ProductSerializer`
  - `GET /api/v1/catalog/products/` — list (filterable by `category_id`)
  - `POST /api/v1/catalog/products/` — create
  - `PATCH /api/v1/catalog/products/{id}/` — update
  - `DELETE /api/v1/catalog/products/{id}/` — soft-delete
  - `POST /api/v1/catalog/products/{id}/upload-photo/` — upload to S3, save URL in `photo_url`
  - `PATCH /api/v1/catalog/products/{id}/label/` — set or clear highlight label (send `{"label": "Más vendido"}` or `{"label": null}`)
  - Verify: upload photo → URL returned; set label → product has label; clear label → label is null
  - _Requirements: R2.2, R3.2, R5.1, R5.2_

- [ ] 8. Toppings API
  - Create `ToppingSerializer`
  - `GET /api/v1/catalog/products/{id}/toppings/` — list toppings for a product
  - `POST /api/v1/catalog/products/{id}/toppings/` — create
  - `PATCH /api/v1/catalog/toppings/{id}/` — update
  - `DELETE /api/v1/catalog/toppings/{id}/` — soft-delete
  - Verify: topping belongs to correct product; deleting product cascades to toppings
  - _Requirements: R2.3_

- [ ] 9. Public menu endpoint
  - `GET /api/v1/catalog/{slug}/menu/` — no auth required
  - Returns: restaurant basic info + categories (only `is_active=true`) → products (only `is_active=true`) with label → toppings (only `is_active=true`)
  - Products with `category_id IS NULL` appended at the end as an unlabeled group
  - Verify: inactive categories/products/toppings excluded; uncategorized products appear at end; highlight labels included
  - _Requirements: R3.3, R5.3, R5.4_

- [ ] 10. Order history API
  - `GET /api/v1/orders/` — list orders for the restaurant (via mixin), with filters: `status`, `date_from`, `date_to`
  - `GET /api/v1/orders/{id}/` — order detail including items, toppings, notes
  - Response includes: reference_number, created_at, items summary, total, delivery_type, payment method type, status
  - Verify: filters return correct subset; detail shows full item breakdown
  - _Requirements: R4.1, R4.2, R4.3_

- [ ] 11. Frontend project setup
  - Create `tragon_frontend/` with Astro 7.x, React integration, TailwindCSS
  - Configure SSR adapter, `astro.config.mjs`
  - Install: nanostores, @nanostores/react
  - Create `src/stores/auth.ts` — JWT token management (access, refresh, isAuthenticated, auto-refresh on 401)
  - Create `src/lib/api.ts` — fetch wrapper with JWT injection and auto-refresh logic
  - Create `Dockerfile` for the frontend (Node 20, pnpm)
  - Verify: `pnpm build` succeeds
  - _Requirements: —_

- [ ] 12. Frontend: login and registration pages
  - `src/pages/admin/login.astro` + `LoginForm.tsx` React island
  - `src/pages/admin/register.astro` + `RegisterForm.tsx` React island
  - On success: store JWT, redirect to dashboard
  - On token expiry: auto-refresh; on refresh expiry: redirect to login
  - Verify: full register → login → token refresh cycle
  - _Requirements: R1.3_

- [ ] 13. Frontend: restaurant profile panel
  - `src/pages/admin/settings.astro` + `SettingsForm.tsx` React island
  - Edit: name, address, delivery_fee, logo upload
  - Payment methods CRUD section (list, add, edit, remove)
  - Verify: save profile → changes reflected; upload logo → image displayed
  - _Requirements: R1.2, R3.1_

- [ ] 14. Frontend: menu management panel
  - `src/pages/admin/menu.astro` + `MenuManager.tsx` React island
  - Category CRUD (create, rename, soft-delete)
  - Product CRUD per category (create, edit, soft-delete, photo upload)
  - Topping CRUD per product (create, edit, soft-delete)
  - Highlight label assignment on products
  - Verify: full CRUD cycle for categories/products/toppings; labels display correctly
  - _Requirements: R2.1, R2.2, R2.3, R3.2, R5.1, R5.2_

- [ ] 15. Frontend: order history panel
  - `src/pages/admin/orders.astro` + `OrderList.tsx` React island
  - List view with filters: status, date range
  - Detail view: items, toppings, notes, total, delivery type, payment method
  - Verify: filters work; detail shows complete order breakdown
  - _Requirements: R4.1, R4.2, R4.3_

- [ ] 16. Docker + compose final
  - Add frontend service to `docker-compose.yml`
  - Ensure `docker-compose up` boots backend + frontend + postgres
  - Create `init.sh`: starts compose, runs migrations, verifies health
  - Verify: `./init.sh` runs cleanly from a clean state
  - _Requirements: —_

## Notes

- No automated tests — time constraint decision (see `ARCHITECTURE.md`).
- Branch convention per `AGENTS.md`: `feat/TRA-<NN>/<short-description>` per top-level task.
- S3 access in development: use localstack or a real S3 bucket with dev credentials (team decision pending).
- Order models (task 2.7) are implemented here but are read-only in this module. Order creation logic belongs to `client-ordering`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"] },
    { "id": 2, "tasks": ["2.8", "11"] },
    { "id": 3, "tasks": ["3"] },
    { "id": 4, "tasks": ["4", "5", "6", "7", "8", "12"] },
    { "id": 5, "tasks": ["9", "10", "13", "14", "15"] },
    { "id": 6, "tasks": ["16"] }
  ]
}
```
