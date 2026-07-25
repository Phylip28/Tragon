# Requirements Document

## Introduction

The Kitchen Panel is a real-time internal interface for restaurant operators (chefs, cashiers) to visualize and manage active orders. Orders are displayed as color-coded cards and can be filtered by status and delivery type. Updates happen in real time without page reload.

Depends on: restaurant-admin and client-ordering modules being functional.

## Glossary

- **Kitchen Panel**: Real-time web interface for internal order management by restaurant staff.
- **Operator**: Restaurant staff (chef, cashier) who uses the Kitchen Panel.
- **Order Card**: Visual element displaying all order information with color coding by status.
- **Restaurant Group**: Logical grouping of all connected operator devices for a single restaurant, ensuring synchronized updates.

## Requirements

### Requirement 1: Order Status with Color Coding

**User Story:** As an operator, I want orders displayed with color-coded status, so that I can identify urgency and progress at a glance.

#### Acceptance Criteria

1. THE system SHALL support operational order statuses: received, confirmed, in_preparation, completed, and cancelled.
2. THE Kitchen Panel SHALL display each Order Card with a distinct background color by status: red for received, orange for confirmed, yellow for in_preparation, green for completed, grey for cancelled.
3. WHEN an order status changes, THE Kitchen Panel SHALL update the Order Card color in real time without page reload.
4. THE Kitchen Panel SHALL sort Order Cards by arrival time ascending (oldest first = most urgent).
5. THE Kitchen Panel SHALL display a live elapsed-time counter on each Order Card, updated every 60 seconds.

### Requirement 2: Status Management from Panel

**User Story:** As an operator, I want to advance or cancel order status from the panel, so that all connected devices reflect the change immediately.

#### Acceptance Criteria

1. THE Kitchen Panel SHALL show a button on each Order Card to advance to the next status in sequence: received → confirmed → in_preparation → completed.
2. WHEN the operator presses the advance button, THE system SHALL persist the new status and propagate the update to all connected operator devices in the same Restaurant Group.
3. THE Kitchen Panel SHALL show a cancel button on each Order Card.
4. WHEN the operator presses cancel, THE Kitchen Panel SHALL request confirmation before executing the cancellation.
5. IF the order is already in completed status, THEN THE Kitchen Panel SHALL disable the advance button.

### Requirement 3: Real-Time Updates

**User Story:** As an operator, I want the panel to update automatically when new orders arrive or status changes, without manual page refresh.

#### Acceptance Criteria

1. WHEN the operator accesses the Kitchen Panel, THE system SHALL establish a persistent real-time connection authenticated with the owner's credentials.
2. WHEN a new order is created for the restaurant, THE system SHALL push the new order to all connected Kitchen Panel instances in the Restaurant Group without page reload.
3. THE system SHALL group all connected operator sessions of the same restaurant into a single Restaurant Group so they all receive the same updates.
4. IF the real-time connection drops, THEN THE Kitchen Panel SHALL reconnect automatically with increasing delay (initial 1 second, maximum 30 seconds between attempts).
5. WHILE the connection is interrupted, THE Kitchen Panel SHALL show a visual indicator that the panel is not receiving live updates.

### Requirement 4: Filterable Views

**User Story:** As an operator, I want to filter visible orders by status and delivery type, so that I can focus on relevant information for my role.

#### Acceptance Criteria

1. THE Kitchen Panel SHALL allow filtering by one or more statuses simultaneously.
2. THE Kitchen Panel SHALL allow filtering by delivery type: delivery, pickup, dine-in.
3. THE Kitchen Panel SHALL exclude completed orders by default, with an option to show them.
4. THE Kitchen Panel SHALL persist filter preferences per device and restore them on reload.
5. WHEN filters change, THE Kitchen Panel SHALL apply them immediately without page reload.

### Requirement 5: Order Card Content

**User Story:** As an operator, I want to see all relevant order information on each card, so that I can prepare and deliver it correctly.

#### Acceptance Criteria

1. THE Order Card SHALL display: reference number, item list with toppings and special instructions, delivery type, address (if delivery), payment method, arrival time, and elapsed time counter.
