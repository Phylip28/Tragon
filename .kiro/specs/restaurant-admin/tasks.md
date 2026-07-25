# Implementation Plan: Restaurant Admin

## Overview

Foundational module for Tragón. Sets up Django backend (accounts, restaurants, catalog, orders apps), Astro frontend (admin panel with React islands), Docker dev infrastructure, and property-based tests. No external module dependencies.

## Tasks

- [ ] 1. Backend project setup
  - [ ] 1.1 Initialize Django project with `uv` and `pyproject.toml`
    - Create `tragon_backend/` directory with `pyproject.toml` (pinned: Django==5.2.4, djangorestframework, djangorestframework-simplejwt, django-cors-headers, psycopg[binary], boto3, hypothesis, pytest-django, ruff)
    - Initialize `uv` project: `uv init`, `uv sync`
    - Run `django-admin startproject config .` inside `tragon_backend/`
    - _Requirements: 6.3, 6.4_

  - [ ] 1.2 Configure Django settings (base, development, production)
    - Create `config/settings/base.py` with INSTALLED_APPS, middleware (corsheaders), REST_FRAMEWORK config, SIMPLE_JWT config, AUTH_USER_MODEL, custom exception handler
    - Create `config/settings/development.py` with DEBUG=True, local PostgreSQL, console email backend
    - Create `config/settings/production.py` (placeholder for RDS, S3, Secrets Manager)
    - Set up `config/urls.py` with versioned API prefix `/api/v1/`
    - _Requirements: 1.4, 6.1, 6.2_

  - [ ] 1.3 Create Django apps skeleton
    - Run `startapp` for: accounts, restaurants, catalog, orders
    - Place apps under `apps/` directory with proper `AppConfig` labels
    - Create `apps/__init__.py` and each app's `__init__.py`
    - _Requirements: 1.1, 2.1, 4.5, 5.1_

- [ ] 2. Database models
  - [ ] 2.1 Implement Owner model (accounts app)
    - Extend `AbstractUser` with email as USERNAME_FIELD, integer PK, `created_at`/`updated_at`
    - Create initial migration
    - _Requirements: 1.1, 1.2, 6.3, 6.4_

  - [ ] 2.2 Implement Restaurant and WhiteLabelConfig models (restaurants app)
    - Restaurant: owner FK, name, slug (auto-generated, unique, non-editable), address, breb_key, delivery_fee, contact_phone, contact_email, timestamps
    - WhiteLabelConfig: OneToOne to Restaurant, primary_color, secondary_color, logo_url, display_name, timestamps
    - Implement `save()` with slug generation using `slugify` + `secrets.token_hex(3)`
    - _Requirements: 1.2, 2.1, 2.3, 2.4, 3.1, 3.3, 6.3, 6.4_

  - [ ] 2.3 Implement Category, Product, Topping models (catalog app)
    - Category: restaurant FK, name, sort_order, unique_together (restaurant, name), timestamps
    - Product: category FK, restaurant FK, name, description, photo_url, base_price, ingredients, is_available, timestamps
    - Topping: product FK, restaurant FK, name, additional_price, timestamps
    - _Requirements: 4.1, 4.2, 4.3, 6.3, 6.4_

  - [ ] 2.4 Implement Order, OrderItem, OrderItemTopping models (orders app)
    - Order: restaurant FK, reference_number (unique), status (TextChoices), delivery_type, payment_method, customer info fields, total, notes, timestamps
    - OrderItem: order FK, product FK (SET_NULL), product_name snapshot, quantity, unit_price, timestamps
    - OrderItemTopping: order_item FK, topping_name snapshot, additional_price, timestamps
    - Implement `VALID_TRANSITIONS` dict and `can_transition_to()` method
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 6.3, 6.4_

  - [ ] 2.5 Register all models in Django Admin
    - Create `admin.py` for each app with appropriate `ModelAdmin` classes
    - Configure list_display, list_filter, search_fields for each model
    - _Requirements: 1.1, 2.1, 4.1, 5.1_

- [ ] 3. Checkpoint — Verify models and migrations
  - Ensure all migrations run cleanly, `ruff check .` passes, ask the user if questions arise.

- [ ] 4. Authentication endpoints
  - [ ] 4.1 Implement registration endpoint
    - Create `RegistrationSerializer` (validates owner_name, email, password, restaurant_name)
    - Create `RegisterView` (POST `/api/v1/accounts/register/`) — creates Owner + Restaurant atomically, returns owner data + restaurant data (with slug) + JWT tokens
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ] 4.2 Implement token endpoints (login + refresh)
    - Configure Simple JWT's `TokenObtainPairView` at `/api/v1/accounts/token/`
    - Configure `TokenRefreshView` at `/api/v1/accounts/token/refresh/`
    - Wire up `apps/accounts/urls.py`
    - _Requirements: 1.4, 1.5, 1.6_

  - [ ]* 4.3 Write property test: Login returns valid JWT pair (Property 2)
    - **Property 2: Login returns valid JWT pair**
    - Use Hypothesis to generate valid owner credentials, register, then call token endpoint and assert both access and refresh tokens are non-empty strings
    - **Validates: Requirements 1.4**

  - [ ]* 4.4 Write property test: Slug derivation from restaurant name (Property 1)
    - **Property 1: Slug derivation from restaurant name**
    - Use Hypothesis `text()` strategy to generate restaurant names, verify slug = slugify(name) + "-" + 6 hex chars, and slug is URL-safe
    - **Validates: Requirements 1.2**

- [ ] 5. Restaurant profile and white-label endpoints
  - [ ] 5.1 Implement RestaurantViewSet with `/me/` endpoints
    - Create `RestaurantSerializer` (exclude slug from writable fields)
    - Create `IsRestaurantOwner` permission
    - GET/PATCH `/api/v1/restaurants/me/` — retrieve and update own restaurant
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 5.2 Implement white-label endpoints
    - Create `WhiteLabelSerializer`
    - GET/PUT `/api/v1/restaurants/me/white-label/`
    - GET `/api/v1/restaurants/{slug}/public/` — public restaurant data + white-label (no auth)
    - _Requirements: 3.1, 3.3_

  - [ ] 5.3 Implement multi-tenant isolation mixin
    - Create `RestaurantScopedMixin` with `get_queryset()` and `perform_create()` filtering by authenticated owner's restaurant
    - Apply mixin to restaurant, catalog, and order ViewSets
    - _Requirements: 6.1, 6.2_

  - [ ]* 5.4 Write property test: Slug immutability (Property 3)
    - **Property 3: Slug immutability**
    - Use Hypothesis to generate PATCH payloads containing a `slug` field, verify stored slug remains unchanged
    - **Validates: Requirements 2.1, 2.4**

  - [ ]* 5.5 Write property test: Restaurant configuration round-trip (Property 4)
    - **Property 4: Restaurant configuration round-trip**
    - Generate valid config payloads, PATCH then GET, assert all fields match
    - **Validates: Requirements 2.3**

  - [ ]* 5.6 Write property test: White-label configuration round-trip (Property 5)
    - **Property 5: White-label configuration round-trip**
    - Generate valid white-label payloads, PUT then GET public endpoint, assert config values match
    - **Validates: Requirements 3.3**

- [ ] 6. Checkpoint — Verify auth and restaurant endpoints
  - Ensure all tests pass, `ruff check .` passes, ask the user if questions arise.

- [ ] 7. Catalog CRUD endpoints
  - [ ] 7.1 Implement CategoryViewSet
    - Full CRUD (list, create, update, delete) at `/api/v1/catalog/categories/`
    - Inherits `RestaurantScopedMixin` for automatic isolation
    - _Requirements: 4.1, 4.5, 6.1, 6.2_

  - [ ] 7.2 Implement ProductViewSet with photo upload
    - Full CRUD at `/api/v1/catalog/products/`
    - POST `/api/v1/catalog/products/{id}/upload-photo/` — upload to S3, store URL
    - Inherits `RestaurantScopedMixin`
    - _Requirements: 4.2, 4.4, 4.5, 6.1, 6.2_

  - [ ] 7.3 Implement ToppingViewSet
    - Full CRUD at `/api/v1/catalog/toppings/`
    - Inherits `RestaurantScopedMixin`
    - _Requirements: 4.3, 4.5, 6.1, 6.2_

  - [ ] 7.4 Implement public menu endpoint
    - GET `/api/v1/catalog/{slug}/menu/` — returns full menu (categories → products → toppings) for the given restaurant slug (no auth required)
    - _Requirements: 3.2, 3.3_

  - [ ]* 7.5 Write property test: Menu entity CRUD round-trip (Property 6)
    - **Property 6: Menu entity CRUD round-trip**
    - Use Hypothesis to generate valid category/product/topping data, POST then GET, assert field equality excluding server-generated fields
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 7.6 Write property test: JWT protection on menu endpoints (Property 7)
    - **Property 7: JWT protection on menu endpoints**
    - For each catalog endpoint, send request without Authorization header, assert 401 response
    - **Validates: Requirements 4.5**

- [ ] 8. Order management endpoints
  - [ ] 8.1 Implement OrderViewSet (list, detail, filters)
    - GET `/api/v1/orders/` with query params: status, date_from, date_to
    - GET `/api/v1/orders/{id}/`
    - Inherits `RestaurantScopedMixin`
    - Serializer includes: reference_number, created_at, items summary, total, delivery_type, payment_method, status
    - _Requirements: 5.1, 5.4, 5.5, 6.1, 6.2_

  - [ ] 8.2 Implement order state machine and status transition endpoint
    - Create `OrderStateMachine` class in `apps/orders/state_machine.py`
    - PATCH `/api/v1/orders/{id}/status/` — validates transition, updates status
    - POST `/api/v1/orders/{id}/cancel/` — transitions to cancelled if allowed
    - Return 409 on invalid transitions
    - _Requirements: 5.2, 5.3_

  - [ ]* 8.3 Write property test: Order state machine validity (Property 8)
    - **Property 8: Order state machine validity**
    - Use Hypothesis to generate (current_status, target_status) pairs, assert transition succeeds iff target is in VALID_TRANSITIONS[current]
    - **Validates: Requirements 5.2, 5.3**

  - [ ]* 8.4 Write property test: Order filter correctness (Property 9)
    - **Property 9: Order filter correctness**
    - Generate sets of orders with varying dates/statuses, apply filter combinations, assert all returned orders satisfy criteria and none are missing
    - **Validates: Requirements 5.4**

  - [ ]* 8.5 Write property test: Order serialization completeness (Property 10)
    - **Property 10: Order serialization completeness**
    - For any order from list endpoint, assert response contains all required fields
    - **Validates: Requirements 5.5**

- [ ] 9. Checkpoint — Verify catalog and order endpoints
  - Ensure all tests pass, `ruff check .` passes, ask the user if questions arise.

- [ ] 10. Multi-tenant isolation verification
  - [ ]* 10.1 Write property test: Multi-restaurant data isolation (Property 11)
    - **Property 11: Multi-restaurant data isolation**
    - Create two restaurants with data, authenticate as each, assert only own resources are returned across all endpoints (categories, products, toppings, orders, config)
    - **Validates: Requirements 6.1, 6.2**

- [ ] 11. Frontend project setup
  - [ ] 11.1 Initialize Astro 7.x project with `pnpm create astro@latest`
    - Create `tragon_frontend/` with `pnpm create astro@latest` (pinned: astro@7.1.3, @astrojs/react, react, react-dom, nanostores, @nanostores/react, tailwindcss)
    - Use `pnpm` as the package manager
    - Configure `astro.config.mjs` with React integration and SSR adapter
    - Set up Tailwind CSS
    - _Requirements: 1.1, 1.3, 3.2_

  - [ ] 11.2 Implement auth store and API client
    - Create `src/stores/auth.ts` with nanostores ($accessToken, $refreshToken, $isAuthenticated, refreshAccessToken)
    - Create `src/lib/api.ts` with `apiFetch()` wrapper (JWT injection, auto-refresh on 401)
    - _Requirements: 1.5, 1.6, 1.7_

- [ ] 12. Frontend auth pages
  - [ ] 12.1 Create login page and form component
    - `src/pages/admin/login.astro` — page shell
    - `src/components/admin/LoginForm.tsx` — React island with email/password fields, calls token endpoint, stores JWT, redirects to dashboard
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ] 12.2 Create registration page and form component
    - `src/pages/admin/register.astro` — page shell
    - `src/components/admin/RegisterForm.tsx` — React island with owner_name, email, password, restaurant_name fields, calls register endpoint
    - _Requirements: 1.1, 1.2_

- [ ] 13. Frontend management panel
  - [ ] 13.1 Create dashboard page
    - `src/pages/admin/dashboard.astro` — summary view (placeholder for order count, recent activity)
    - Auth guard: redirect to login if not authenticated
    - _Requirements: 5.1_

  - [ ] 13.2 Create menu manager page
    - `src/pages/admin/menu.astro` — page shell
    - `src/components/admin/MenuManager.tsx` — React island with category/product/topping CRUD UI
    - Category list with add/edit/delete
    - Product list per category with add/edit/delete + photo upload
    - Topping management per product
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 13.3 Create orders page
    - `src/pages/admin/orders.astro` — page shell
    - `src/components/admin/OrderList.tsx` — React island with order list, status filters, date filters, status transition buttons
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 13.4 Create settings page
    - `src/pages/admin/settings.astro` — page shell
    - `src/components/admin/SettingsForm.tsx` — React island with restaurant profile fields + white-label config (colors, logo, display name)
    - _Requirements: 2.2, 2.3, 3.1_

- [ ] 14. Checkpoint — Verify frontend builds
  - Ensure `pnpm build` succeeds in `tragon_frontend/`, ask the user if questions arise.

- [ ] 15. Docker infrastructure
  - [ ] 15.1 Create Docker and docker-compose setup
    - `tragon_backend/Dockerfile` — Python 3.12, uv install, Django app
    - `tragon_frontend/Dockerfile` — Node 20, pnpm, Astro build
    - `docker-compose.yml` at repo root — services: backend, frontend, postgres (with volume), localstack (S3 emulation for dev)
    - Environment variables for DB connection, JWT secret, S3 config, CORS origins
    - _Requirements: 1.4, 2.1, 4.4, 6.1_

  - [ ] 15.2 Create dev scripts and init.sh
    - `init.sh` — checks Docker, runs `docker-compose up -d`, runs migrations, verifies API health
    - _Requirements: 6.3, 6.4_

- [ ] 16. Final checkpoint — Full integration verification
  - Ensure all tests pass, `docker-compose up` runs cleanly, `ruff check .` passes, frontend builds successfully. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Branch convention: `feat/TRA-<NN>/<short-description>` per top-level task
- This is the foundational module — no dependencies on other Tragón modules

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "11.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "11.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["2.5", "4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3", "4.4", "5.1", "5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4", "5.5", "5.6", "7.1", "7.2", "7.3", "7.4"] },
    { "id": 6, "tasks": ["7.5", "7.6", "8.1", "8.2"] },
    { "id": 7, "tasks": ["8.3", "8.4", "8.5", "10.1"] },
    { "id": 8, "tasks": ["12.1", "12.2"] },
    { "id": 9, "tasks": ["13.1", "13.2", "13.3", "13.4"] },
    { "id": 10, "tasks": ["15.1"] },
    { "id": 11, "tasks": ["15.2"] }
  ]
}
```
