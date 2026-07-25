# Requirements Document — Kitchen Panel

## Introduction

The Kitchen Panel is a real-time internal interface for restaurant operators (chefs, cashiers) to visualize and manage active orders. It uses WebSocket (Django Channels + Redis) for live updates. Orders are displayed as color-coded cards and can be filtered by status and delivery type.

Depends on: restaurant-admin and client-ordering modules being functional.

## Glossary

- **Kitchen Panel**: Real-time web interface at `/kitchen/{restaurant_slug}/` for order management.
- **Operator**: Restaurant staff (chef, cashier) who uses the Kitchen Panel.
- **Order Card**: Visual element displaying all order information with color coding by status.
- **Channel Layer**: Redis-backed messaging layer used by Django Channels for WebSocket groups.
- **Restaurant Group**: Logical WebSocket group identified by restaurant slug.

## Requirements

### Requirement 1: Order Status with Color Coding

**User Story:** As an operator, I want orders displayed with color-coded status, so that I can identify urgency and progress at a glance.

#### Acceptance Criteria

1. THE backend SHALL support operational order statuses: `received`, `confirmed`, `in_preparation`, `completed`, and `cancelled`.
2. THE Kitchen Panel SHALL display each Order Card with a distinct background color by status: red for `received`, orange for `confirmed`, yellow for `in_preparation`, green for `completed`, grey for `cancelled`.
3. WHEN an order status changes, THE Kitchen Panel SHALL update the Order Card color in real time without page reload.
4. THE Kitchen Panel SHALL sort Order Cards by arrival time ascending (oldest first = most urgent).
5. THE Kitchen Panel SHALL display a live elapsed-time counter on each Order Card, updated every 60 seconds.

### Requirement 2: Status Management from Panel

**User Story:** As an operator, I want to advance or cancel order status from the panel, so that all connected devices reflect the change immediately.

#### Acceptance Criteria

1. THE Kitchen Panel SHALL show a button on each Order Card to advance to the next status: `received` → `confirmed` → `in_preparation` → `completed`.
2. WHEN the operator presses the advance button, THE backend SHALL persist the new status and transmit the update to all WebSocket clients in the Restaurant Group.
3. THE Kitchen Panel SHALL show a cancel button on each Order Card.
4. WHEN the operator presses cancel, THE Kitchen Panel SHALL request confirmation before sending the cancellation.
5. IF the order is already in `completed` status, THEN THE Kitchen Panel SHALL disable the advance button.

### Requirement 3: Real-Time WebSocket Updates

**User Story:** As an operator, I want the panel to update automatically when new orders arrive or status changes, without manual page refresh.

#### Acceptance Criteria

1. WHEN the operator accesses the Kitchen Panel, THE frontend SHALL establish a WebSocket connection authenticated via JWT.
2. WHEN a new order is created, THE backend SHALL emit a WebSocket event to the Restaurant Group and THE Kitchen Panel SHALL display the new Order Card without page reload.
3. THE backend SHALL group all WebSocket consumers of the same restaurant into a single Restaurant Group identified by slug.
4. IF the WebSocket connection drops, THEN THE Kitchen Panel SHALL reconnect automatically with exponential backoff (initial 1s, max 30s).
5. WHILE disconnected, THE Kitchen Panel SHALL show a visual indicator that the panel is not receiving live updates.

### Requirement 4: Filterable Views

**User Story:** As an operator, I want to filter visible orders by status and delivery type, so that I can focus on relevant information for my role.

#### Acceptance Criteria

1. THE Kitchen Panel SHALL allow filtering by one or more statuses simultaneously.
2. THE Kitchen Panel SHALL allow filtering by delivery type: delivery, pickup, dine-in.
3. THE Kitchen Panel SHALL exclude `completed` orders by default, with an option to show them.
4. THE Kitchen Panel SHALL persist filter preferences in `localStorage` and restore them on reload.
5. WHEN filters change, THE Kitchen Panel SHALL apply them immediately without page reload.

### Requirement 5: Order Card Content

**User Story:** As an operator, I want to see all relevant order information on each card, so that I can prepare and deliver it correctly.

#### Acceptance Criteria

1. THE Order Card SHALL display: reference number, item list with toppings and special instructions, delivery type, address (if delivery), payment method, arrival time, and elapsed time counter.

### Requirement 6: WebSocket Infrastructure

**User Story:** As a developer, I want Django Channels with Redis as the channel layer, so that the Kitchen Panel can receive real-time updates.

#### Acceptance Criteria

1. THE backend SHALL use Django Channels with ASGI configuration.
2. THE backend SHALL use Redis as Channel Layer via `channels_redis`.
3. THE backend SHALL expose WebSocket endpoint at `/ws/kitchen/{restaurant_slug}/`.
4. THE backend SHALL validate JWT during WebSocket handshake and reject with close code 4001 if invalid.
5. THE backend SHALL add Redis to `docker-compose.yml` as an additional service.
