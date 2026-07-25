# Implementation Plan: Kitchen Panel

## Overview

Real-time Kitchen Panel using Django Channels + Redis (backend) and Astro SSR + React island (frontend). Implementation starts with infrastructure (Redis, ASGI, Channels), then the WebSocket consumer and broadcast logic, followed by the frontend components and hooks, and finally integration wiring.

**Branch:** `feat/TRA-30/kitchen-panel`

## Tasks

- [ ] 1. Infrastructure and WebSocket backend
  - [ ] 1.1 Add Redis service to docker-compose.yml
    - Add `redis:7-alpine` service with volume persistence
    - Expose port 6379
    - _Requirements: 6.5_

  - [ ] 1.2 Install backend dependencies and update settings
    - Add `channels==4.2.0`, `channels-redis==4.2.1`, `redis==5.3.0`, `daphne==4.1.2` to requirements
    - Add `daphne` and `channels` to `INSTALLED_APPS`
    - Configure `CHANNEL_LAYERS` with Redis backend
    - Set `ASGI_APPLICATION = "config.asgi.application"`
    - _Requirements: 6.1, 6.2_

  - [ ] 1.3 Update ASGI configuration with Channels routing
    - Configure `ProtocolTypeRouter` with http and websocket protocols
    - Wire `URLRouter` with websocket URL patterns
    - _Requirements: 6.1_

  - [ ] 1.4 Create WebSocket routing module
    - Create `apps/orders/routing.py` with URL pattern `/ws/kitchen/{restaurant_slug}/`
    - _Requirements: 6.3_

  - [ ] 1.5 Implement KitchenConsumer
    - Create `apps/orders/consumers.py` with `KitchenConsumer` (AsyncWebsocketConsumer)
    - Implement JWT validation from query param on `connect()`
    - Reject with close code 4001 on invalid/missing token
    - Join Channel Layer group `kitchen_{slug}` on successful auth
    - Handle `order.update` and `order.new` event types
    - _Requirements: 3.1, 3.3, 6.3, 6.4_

  - [ ]* 1.6 Write property test for JWT rejection (Property 5)
    - **Property 5: JWT rejection on invalid token**
    - For any absent, malformed, or expired token, connection is rejected with code 4001
    - **Validates: Requirements 3.1, 6.4**

  - [ ]* 1.7 Write property test for group name derivation (Property 6)
    - **Property 6: Restaurant group name derivation is deterministic**
    - For any slug, group name is always `kitchen_{slug}`
    - **Validates: Requirements 3.3**

- [ ] 2. Broadcast logic and signal hooks
  - [ ] 2.1 Implement `broadcast_order_update` helper
    - Create broadcast function that sends `order.update` event to `kitchen_{slug}` group
    - Integrate into existing PATCH `/api/v1/orders/{id}/status/` view after successful status change
    - _Requirements: 2.2, 3.2_

  - [ ] 2.2 Implement `broadcast_new_order` helper and signal
    - Create broadcast function that sends `order.new` event with full order payload
    - Create `post_save` signal on Order model (or hook into existing creation flow) to trigger broadcast on new order
    - _Requirements: 3.2_

  - [ ]* 2.3 Write unit tests for broadcast helpers
    - Test `broadcast_order_update` sends correct event structure
    - Test `broadcast_new_order` includes all required fields (items, toppings, delivery info)
    - _Requirements: 2.2, 3.2_

- [ ] 3. Checkpoint
  - Ensure all backend tests pass, ask the user if questions arise.

- [ ] 4. Frontend: hooks and utilities
  - [ ] 4.1 Create `useWebSocket` hook
    - Implement WebSocket connection with JWT token as query param
    - Implement exponential backoff reconnection (1s initial, 30s max)
    - Expose `isConnected` state and `send` function
    - _Requirements: 3.1, 3.4, 3.5_

  - [ ]* 4.2 Write property test for exponential backoff delay (Property 7)
    - **Property 7: Exponential backoff delay computation**
    - For any attempt N ≥ 0, delay equals `min(2^N * 1000, 30000)` ms
    - **Validates: Requirements 3.4**

  - [ ] 4.3 Create kitchen utility functions
    - Implement `getElapsedMinutes(createdAt, now)` and `formatElapsed(minutes)`
    - Implement `sortByArrivalTime(orders)` (ascending by `created_at`)
    - Implement status-to-color mapping constant `STATUS_COLORS`
    - Implement state machine helpers: `getNextStatus`, `isCancellable`
    - _Requirements: 1.2, 1.4, 1.5, 2.1, 2.5_

  - [ ]* 4.4 Write property tests for utility functions (Properties 1, 2, 3, 4)
    - **Property 1: Status to color mapping is total and correct**
    - **Property 2: Orders are sorted by arrival time ascending**
    - **Property 3: Elapsed time computation correctness**
    - **Property 4: Available actions determined by state machine**
    - **Validates: Requirements 1.2, 1.4, 1.5, 2.1, 2.3, 2.5**

- [ ] 5. Frontend: filter logic
  - [ ] 5.1 Implement FilterBar component and filter logic
    - Create `FilterBar.tsx` with status and delivery type filter toggles
    - Implement `applyFilters(orders, filterState)` function
    - Default: exclude `completed` orders
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [ ] 5.2 Implement localStorage persistence for filters
    - `loadFilters(slug)` reads from `localStorage` with key `kitchen_filters_{slug}`
    - `saveFilters(slug, filters)` writes to `localStorage`
    - Restore filters on page reload
    - _Requirements: 4.4_

  - [ ]* 5.3 Write property tests for filters (Properties 8, 9)
    - **Property 8: Filter correctness**
    - **Property 9: Filter persistence round-trip**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [ ] 6. Frontend: OrderCard and KitchenPanel components
  - [ ] 6.1 Implement OrderCard component
    - Color-coded background by status
    - Display reference number, items with toppings, delivery type, address (if delivery), payment method, arrival time, elapsed time counter (updated every 60s)
    - Advance button (disabled when `completed`)
    - Cancel button with confirmation dialog
    - Call PATCH endpoint on advance/cancel
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.3, 2.4, 2.5, 5.1_

  - [ ] 6.2 Implement KitchenPanel component (React island)
    - Manage orders state, integrate `useWebSocket` hook
    - Handle `new_order` and `order_status_changed` events
    - Sort orders by arrival time ascending
    - Integrate FilterBar and apply filters
    - Show disconnection warning banner when not connected
    - _Requirements: 1.3, 1.4, 3.2, 3.5, 4.5_

  - [ ]* 6.3 Write property test for Order Card content completeness (Property 10)
    - **Property 10: Order card content completeness**
    - For any order with populated fields, rendered card includes all required information
    - **Validates: Requirements 5.1**

- [ ] 7. Frontend: Astro page and wiring
  - [ ] 7.1 Create Astro SSR page at `/kitchen/[slug]/`
    - Create `src/pages/kitchen/[slug].astro`
    - Validate restaurant slug server-side
    - Fetch initial orders via REST API
    - Render `KitchenPanel` React island with `client:load`
    - Pass slug, token (from cookie/param), and initial orders as props
    - _Requirements: 3.1, 6.3_

  - [ ] 7.2 Wire broadcast into existing order status PATCH endpoint
    - Ensure the existing `PATCH /api/v1/orders/{id}/status/` calls `broadcast_order_update` after successful persistence
    - Ensure new order creation triggers `broadcast_new_order` via signal
    - _Requirements: 2.2, 3.2_

- [ ] 8. Checkpoint
  - Ensure all tests pass (backend + frontend), ask the user if questions arise.

- [ ] 9. Integration verification
  - [ ]* 9.1 Write integration test for WebSocket flow
    - Test: connect with valid JWT → receive order update after status PATCH → receive new order event after order creation
    - Test: connect with invalid JWT → connection rejected with code 4001
    - _Requirements: 3.1, 3.2, 6.4_

  - [ ]* 9.2 Write integration test for end-to-end filter and display
    - Test: orders filtered correctly by status and delivery type
    - Test: filter preferences persisted and restored
    - _Requirements: 4.1, 4.2, 4.4_

- [ ] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Branch: `feat/TRA-30/kitchen-panel` — all sub-tasks live on this branch
- Depends on: restaurant-admin (Order model, state machine, JWT) and client-ordering (order creation) being complete

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5"] },
    { "id": 3, "tasks": ["1.6", "1.7", "2.1", "2.2"] },
    { "id": 4, "tasks": ["2.3", "4.1", "4.3"] },
    { "id": 5, "tasks": ["4.2", "4.4", "5.1", "5.2"] },
    { "id": 6, "tasks": ["5.3", "6.1", "6.2"] },
    { "id": 7, "tasks": ["6.3", "7.1", "7.2"] },
    { "id": 8, "tasks": ["9.1", "9.2"] }
  ]
}
```
