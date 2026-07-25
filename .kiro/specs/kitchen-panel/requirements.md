# Requirements Document

## Introduction

The Kitchen Panel is a real-time web interface where the chef views incoming orders and their details. Orders follow this status flow: `received`, `confirmed`, `in_preparation`, `completed`, `cancelled`. It depends on the order-placing module being fully functional.

## Glossary

- **Kitchen Panel**: Web interface where the chef visualizes orders.
- **Operator**: Person responsible for managing order status.
- **Order**: A text entry containing food/drink items with quantities.

## Requirements

### Requirement 1: Order Visualization

**User Story:** As a chef, I want to visualize the 6 most recent confirmed orders, so that I can prepare the food.

#### Acceptance Criteria

1. THE Kitchen Panel SHALL display orders in an organized layout with a legible size.
2. WHEN a new order is received, THE Kitchen Panel SHALL check the order queue and display only the first 6 orders with `confirmed` status.
3. IF an order is cancelled, THEN THE Kitchen Panel SHALL remove that order from the queue and display the next order in line, always respecting the 6-order limit.
