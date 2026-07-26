# ARCHITECTURE.md — Tragón

> Top-level system map. Keep concise; point to deeper docs when needed.
> For non-negotiable behavioral rules, see `.kiro/steering/constraints.md`.
> For the normalized database schema, see `DATABASE.md`.

## System Shape

- **Product**: Platform that automates order taking for restaurants
- **Primary user workflows**: Client browses menu and places order → Restaurant manages menu and tracks orders → Chef visualizes active orders in real time → Driver navigates delivery route
- **Runtime surfaces**: Astro 7.x SSR (frontend) + Django 5.2.x REST (backend)
- **Architecture style**: Monolith, modularized by Django app
- **Authentication**: JWT + roles (restaurant owner, operator). Clients do not authenticate.
- **Source of truth for requirements**: `.kiro/specs/`

## Domain Map

| Module             | Purpose                                                             | Backend Entry Points                 | Frontend Entry Points  |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------ | ---------------------- |
| `restaurant-admin` | Profile config, menu CRUD, image uploads, order history             | `apps/restaurants/`, `apps/catalog/` | `/admin/*` pages       |
| `client-ordering`  | Menu browsing, cart, delivery/payment selection, order confirmation | `apps/orders/` (create)              | `/menu/[slug]/` pages  |
| `kitchen-panel`    | Real-time order visualization for the chef                          | `apps/orders/` (WebSocket)           | `/cocina/[slug]/` page |
| `delivery-routing` | Map with route autocomplete for drivers                             | `apps/delivery/`                     | `/delivery/` page      |

## Module Dependencies

`restaurant-admin` is foundational and must exist first. `client-ordering` depends on a restaurant with products being configured. Both `kitchen-panel` and `delivery-routing` depend on orders existing via `client-ordering`.

## Layer Model

Fixed directional model — agents must not invent ad hoc architecture:

```
┌──────────────────────────────────────────────────────────┐
│  Astro SSR Pages + React Islands (frontend)              │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTPS (REST + WebSocket)
┌────────────────────────▼─────────────────────────────────┐
│  Django REST Framework (backend)                          │
│                                                           │
│  URL Router → ViewSet → Service → Model → DB             │
│                            ↓                              │
│                    S3 (images) · Redis (Channels)         │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  PostgreSQL (AWS RDS)                                     │
└──────────────────────────────────────────────────────────┘
```

### Rules

- Views handle HTTP concerns only (parsing, validation, response formatting).
- Services contain business logic (state transitions, calculations, side effects).
- Models are data definitions — no business logic beyond field constraints.
- Cross-cutting concerns (S3 uploads, notifications, WebSocket events) are injected via explicit service calls, not middleware magic.

## Cross-Cutting Concerns

| Concern         | Approach                   | Notes                                                          |
| --------------- | -------------------------- | -------------------------------------------------------------- |
| Auth            | JWT + roles via Simple JWT | Restaurant owners and operators authenticate; clients do not   |
| CORS            | `django-cors-headers`      | Allow frontend origin only                                     |
| Error responses | Consistent JSON format     | `{ "error": "code", "message": "...", "details": {} }`         |
| Image uploads   | Direct to S3 via `boto3`   | Returns public URL, stored on `photo_url` / `logo_url` fields  |
| Notifications   | Telegram Bot API           | Restaurant receives order notifications via `telegram_chat_id` |
| Logging         | Python `logging` module    | Structured, no print statements                                |
| Migrations      | Django ORM migrations      | All schema changes through versioned migration files           |

## Infrastructure

| Layer             | Choice                              | Notes                                               |
| ----------------- | ----------------------------------- | --------------------------------------------------- |
| Local dev         | Docker + docker-compose             | PostgreSQL, Redis, backend, frontend                |
| Database          | PostgreSQL on AWS RDS               | Single instance, no read replicas for MVP           |
| Storage           | AWS S3                              | Restaurant logos and product photos                 |
| Real-time         | Django Channels + Redis             | WebSocket for kitchen-panel only                    |
| Deployment target | AWS Lambda + EventBridge **or** ECS | Final decision pending                              |
| Containers        | Docker                              | Backend and frontend each have their own Dockerfile |

## What We Are NOT Doing

- **Tests**: No automated test suite. Time constraint.
- **Client authentication**: Clients place orders without logging in.
- **WhatsApp integration**: Only Telegram for notifications in MVP.
