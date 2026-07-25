# Design Document — Kitchen Panel

## Overview

The Kitchen Panel module provides a real-time internal interface for restaurant operators (chefs, cashiers) to visualize and manage active orders. It uses Django Channels 4.x with Redis as the Channel Layer for WebSocket communication. The frontend is an Astro SSR page with a React island that displays orders as color-coded cards, supports filtering, and allows status transitions.

Depends on: restaurant-admin (Order model, state machine, JWT auth) and client-ordering (order creation flow).

## Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Astro 7.x SSR + React Island (Kitchen Panel)              │
│  /kitchen/[slug]/ → KitchenPanel.tsx                        │
│  - OrderCard.tsx (color-coded by status)                    │
│  - FilterBar.tsx (status + delivery type)                   │
│  - useWebSocket hook (reconnection + auth)                  │
└──────────┬──────────────────────────────────┬───────────────┘
           │ HTTPS (REST API)                 │ WSS (WebSocket)
┌──────────▼──────────────────────────────────▼───────────────┐
│  Django Channels (ASGI)                                      │
│  - HTTP → DRF (existing PATCH /api/v1/orders/{id}/status/)  │
│  - WS  → KitchenConsumer (/ws/kitchen/{slug}/)              │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                  │
┌──────────▼────────────┐    ┌────────────────▼───────────────┐
│  PostgreSQL (orders)  │    │  Redis (Channel Layer)          │
│  (existing)           │    │  Group: kitchen_{slug}          │
└───────────────────────┘    └────────────────────────────────┘
```

### Request Flow: Status Change

```
Operator clicks "Advance" → Frontend calls PATCH /api/v1/orders/{id}/status/
  → DRF view validates transition (existing state machine)
  → Persists new status
  → Broadcasts to Channel Layer group kitchen_{slug}
  → All connected KitchenConsumers receive update
  → Each frontend updates local order state reactively
```

### Request Flow: New Order Arrives

```
Client confirms order → POST /api/v1/orders/ (client-ordering module)
  → Order persisted with status=received
  → Signal/hook broadcasts new_order event to Channel Layer group
  → All KitchenConsumers in restaurant group receive event
  → Frontend prepends new OrderCard (sorted by arrival time)
```

## Backend Additions

### Module Structure

```
tragon_backend/
├── config/
│   ├── asgi.py              # Updated: Channels + WebSocket routing
│   └── settings/
│       └── base.py          # Updated: CHANNEL_LAYERS, INSTALLED_APPS
├── apps/
│   └── orders/
│       ├── consumers.py     # NEW: KitchenConsumer
│       ├── routing.py       # NEW: WebSocket URL patterns
│       ├── signals.py       # NEW: post-save signal for broadcast
│       └── views.py         # Updated: broadcast after status change
└── docker-compose.yml       # Updated: Redis service
```

### ASGI Configuration

```python
# config/asgi.py
import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

django_asgi_app = get_asgi_application()

from apps.orders.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": URLRouter(websocket_urlpatterns),
    }
)
```

### Channel Layer Settings

```python
# config/settings/base.py (additions)
INSTALLED_APPS += [
    "daphne",
    "channels",
]

ASGI_APPLICATION = "config.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("redis", 6379)],
        },
    },
}
```

### WebSocket Routing

```python
# apps/orders/routing.py
from django.urls import re_path

from apps.orders.consumers import KitchenConsumer

websocket_urlpatterns = [
    re_path(r"ws/kitchen/(?P<restaurant_slug>[\w-]+)/$", KitchenConsumer.as_asgi()),
]
```

### KitchenConsumer

```python
# apps/orders/consumers.py
import json

from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError


class KitchenConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for the Kitchen Panel real-time updates."""

    async def connect(self):
        self.restaurant_slug = self.scope["url_route"]["kwargs"]["restaurant_slug"]
        self.group_name = f"kitchen_{self.restaurant_slug}"

        # JWT validation from query param
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        token = self._extract_token(query_string)

        if not await self._validate_token(token):
            await self.close(code=4001)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def order_update(self, event):
        """Handle order status update broadcast."""
        await self.send(text_data=json.dumps(event["data"]))

    async def order_new(self, event):
        """Handle new order broadcast."""
        await self.send(text_data=json.dumps(event["data"]))

    def _extract_token(self, query_string: str) -> str | None:
        """Extract JWT token from query string: ?token=xxx."""
        params = dict(
            pair.split("=", 1)
            for pair in query_string.split("&")
            if "=" in pair
        )
        return params.get("token")

    async def _validate_token(self, token: str | None) -> bool:
        """Validate JWT access token."""
        if not token:
            return False
        try:
            AccessToken(token)
            return True
        except TokenError:
            return False
```

### Broadcasting on Status Change

```python
# apps/orders/views.py (addition to existing status update logic)
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def broadcast_order_update(order):
    """Broadcast order update to all kitchen consumers for the restaurant."""
    channel_layer = get_channel_layer()
    group_name = f"kitchen_{order.restaurant.slug}"
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "order.update",
            "data": {
                "event": "order_status_changed",
                "order_id": order.id,
                "reference_number": order.reference_number,
                "status": order.status,
                "updated_at": order.updated_at.isoformat(),
            },
        },
    )


def broadcast_new_order(order):
    """Broadcast new order to all kitchen consumers for the restaurant."""
    channel_layer = get_channel_layer()
    group_name = f"kitchen_{order.restaurant.slug}"
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "order.new",
            "data": {
                "event": "new_order",
                "order": {
                    "id": order.id,
                    "reference_number": order.reference_number,
                    "status": order.status,
                    "delivery_type": order.delivery_type,
                    "payment_method": order.payment_method,
                    "customer_name": order.customer_name,
                    "delivery_address": order.delivery_address,
                    "total": str(order.total),
                    "notes": order.notes,
                    "created_at": order.created_at.isoformat(),
                    "items": [
                        {
                            "product_name": item.product_name,
                            "quantity": item.quantity,
                            "unit_price": str(item.unit_price),
                            "toppings": [
                                {
                                    "topping_name": t.topping_name,
                                    "additional_price": str(t.additional_price),
                                }
                                for t in item.toppings.all()
                            ],
                        }
                        for item in order.items.all()
                    ],
                },
            },
        },
    )
```

### Docker Compose Redis Service

```yaml
# docker-compose.yml (addition)
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

### Dependencies

```
# requirements.txt (additions)
channels==4.2.0
channels-redis==4.2.1
redis==5.3.0
daphne==4.1.2
```

## Frontend Additions

### Page Structure

```
tragon_frontend/
├── src/
│   ├── pages/
│   │   └── kitchen/
│   │       └── [slug].astro        # SSR page, validates slug server-side
│   ├── components/
│   │   └── kitchen/
│   │       ├── KitchenPanel.tsx     # Main React island (client:load)
│   │       ├── OrderCard.tsx        # Color-coded order card
│   │       └── FilterBar.tsx        # Status + delivery type filters
│   └── hooks/
│       └── useWebSocket.ts          # WS connection with reconnection
```

### Color Mapping

```typescript
// constants
export const STATUS_COLORS: Record<string, string> = {
  received: "#EF4444",      // red
  confirmed: "#F97316",     // orange
  in_preparation: "#EAB308", // yellow
  completed: "#22C55E",     // green
  cancelled: "#6B7280",     // grey
};
```

### State Machine: Available Actions

```typescript
export type OrderStatus =
  | "received"
  | "confirmed"
  | "in_preparation"
  | "completed"
  | "cancelled";

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  received: "confirmed",
  confirmed: "in_preparation",
  in_preparation: "completed",
  completed: null,
  cancelled: null,
};

const CANCELLABLE_STATUSES: Set<OrderStatus> = new Set([
  "received",
  "confirmed",
  "in_preparation",
]);

export function getNextStatus(current: OrderStatus): OrderStatus | null {
  return NEXT_STATUS[current];
}

export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.has(status);
}
```

### useWebSocket Hook

```typescript
// src/hooks/useWebSocket.ts
import { useState, useEffect, useRef, useCallback } from "react";

interface UseWebSocketOptions {
  url: string;
  token: string;
  onMessage: (data: unknown) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  send: (data: unknown) => void;
}

export function useWebSocket({
  url,
  token,
  onMessage,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const fullUrl = `${url}?token=${token}`;
    const ws = new WebSocket(fullUrl);

    ws.onopen = () => {
      setIsConnected(true);
      attemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    ws.onclose = () => {
      setIsConnected(false);
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [url, token, onMessage]);

  const scheduleReconnect = useCallback(() => {
    const delay = getReconnectDelay(attemptRef.current);
    attemptRef.current += 1;
    timerRef.current = setTimeout(connect, delay);
  }, [connect]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { isConnected, send };
}

export function getReconnectDelay(attempt: number): number {
  return Math.min(Math.pow(2, attempt) * 1000, 30000);
}
```

### Filter Logic

```typescript
// src/components/kitchen/FilterBar.tsx (logic)
export interface FilterState {
  statuses: OrderStatus[];
  deliveryTypes: string[];
}

const DEFAULT_FILTERS: FilterState = {
  statuses: ["received", "confirmed", "in_preparation"],
  deliveryTypes: ["delivery", "pickup", "dine_in"],
};

const STORAGE_KEY_PREFIX = "kitchen_filters_";

export function loadFilters(slug: string): FilterState {
  const key = `${STORAGE_KEY_PREFIX}${slug}`;
  const stored = localStorage.getItem(key);
  if (!stored) return DEFAULT_FILTERS;
  try {
    return JSON.parse(stored) as FilterState;
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function saveFilters(slug: string, filters: FilterState): void {
  const key = `${STORAGE_KEY_PREFIX}${slug}`;
  localStorage.setItem(key, JSON.stringify(filters));
}

export function applyFilters(
  orders: Order[],
  filters: FilterState
): Order[] {
  return orders.filter(
    (order) =>
      filters.statuses.includes(order.status) &&
      filters.deliveryTypes.includes(order.delivery_type)
  );
}
```

### Elapsed Time Computation

```typescript
export function getElapsedMinutes(createdAt: string, now: Date): number {
  const created = new Date(createdAt);
  return Math.floor((now.getTime() - created.getTime()) / 60000);
}

export function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}
```

### Order Sorting

```typescript
export function sortByArrivalTime(orders: Order[]): Order[] {
  return [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}
```

### KitchenPanel Component (React Island)

```typescript
// src/components/kitchen/KitchenPanel.tsx
import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { OrderCard } from "./OrderCard";
import { FilterBar } from "./FilterBar";
import {
  applyFilters,
  loadFilters,
  saveFilters,
  FilterState,
} from "./FilterBar";
import { sortByArrivalTime } from "./utils";

interface KitchenPanelProps {
  slug: string;
  token: string;
  initialOrders: Order[];
}

export function KitchenPanel({ slug, token, initialOrders }: KitchenPanelProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filters, setFilters] = useState<FilterState>(() => loadFilters(slug));

  const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/kitchen/${slug}/`;

  const handleMessage = useCallback((data: any) => {
    if (data.event === "new_order") {
      setOrders((prev) => sortByArrivalTime([...prev, data.order]));
    } else if (data.event === "order_status_changed") {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === data.order_id ? { ...o, status: data.status, updated_at: data.updated_at } : o
        )
      );
    }
  }, []);

  const { isConnected } = useWebSocket({ url: wsUrl, token, onMessage: handleMessage });

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    saveFilters(slug, newFilters);
  };

  const displayedOrders = applyFilters(sortByArrivalTime(orders), filters);

  return (
    <div className="kitchen-panel">
      {!isConnected && (
        <div className="connection-warning" role="alert">
          Disconnected — not receiving live updates
        </div>
      )}
      <FilterBar filters={filters} onChange={handleFilterChange} />
      <div className="order-grid">
        {displayedOrders.map((order) => (
          <OrderCard key={order.id} order={order} slug={slug} token={token} />
        ))}
      </div>
    </div>
  );
}
```

### OrderCard Component

```typescript
// src/components/kitchen/OrderCard.tsx
import { useState, useEffect } from "react";
import { STATUS_COLORS } from "./constants";
import { getNextStatus, isCancellable } from "./stateMachine";
import { getElapsedMinutes, formatElapsed } from "./utils";

interface OrderCardProps {
  order: Order;
  slug: string;
  token: string;
}

export function OrderCard({ order, slug, token }: OrderCardProps) {
  const [elapsed, setElapsed] = useState(() =>
    getElapsedMinutes(order.created_at, new Date())
  );
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsedMinutes(order.created_at, new Date()));
    }, 60000);
    return () => clearInterval(interval);
  }, [order.created_at]);

  const nextStatus = getNextStatus(order.status);
  const canCancel = isCancellable(order.status);
  const bgColor = STATUS_COLORS[order.status] ?? "#6B7280";

  async function handleAdvance() {
    if (!nextStatus) return;
    await fetch(`/api/v1/orders/${order.id}/status/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  async function handleCancel() {
    if (!showCancelConfirm) {
      setShowCancelConfirm(true);
      return;
    }
    await fetch(`/api/v1/orders/${order.id}/status/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    setShowCancelConfirm(false);
  }

  return (
    <div className="order-card" style={{ backgroundColor: bgColor }}>
      <div className="order-header">
        <span className="reference">{order.reference_number}</span>
        <span className="elapsed">{formatElapsed(elapsed)}</span>
      </div>
      <div className="order-items">
        {order.items.map((item, i) => (
          <div key={i} className="order-item">
            <span>{item.quantity}x {item.product_name}</span>
            {item.toppings.length > 0 && (
              <ul className="toppings">
                {item.toppings.map((t, j) => (
                  <li key={j}>{t.topping_name}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {order.notes && <p className="notes">{order.notes}</p>}
      <div className="order-meta">
        <span>{order.delivery_type}</span>
        {order.delivery_type === "delivery" && <span>{order.delivery_address}</span>}
        <span>{order.payment_method}</span>
      </div>
      <div className="order-actions">
        {nextStatus && (
          <button onClick={handleAdvance} className="btn-advance">
            → {nextStatus.replace("_", " ")}
          </button>
        )}
        {canCancel && (
          <button onClick={handleCancel} className="btn-cancel">
            {showCancelConfirm ? "Confirm cancel?" : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
}
```

## Data Models

This module does not introduce new database models. It consumes the existing `Order`, `OrderItem`, and `OrderItemTopping` models from the restaurant-admin module.

### WebSocket Message Types

```typescript
// Inbound messages (server → client)
interface OrderStatusChanged {
  event: "order_status_changed";
  order_id: number;
  reference_number: string;
  status: OrderStatus;
  updated_at: string;
}

interface NewOrder {
  event: "new_order";
  order: {
    id: number;
    reference_number: string;
    status: OrderStatus;
    delivery_type: string;
    payment_method: string;
    customer_name: string;
    delivery_address: string;
    total: string;
    notes: string;
    created_at: string;
    items: {
      product_name: string;
      quantity: number;
      unit_price: string;
      toppings: { topping_name: string; additional_price: string }[];
    }[];
  };
}
```

### Frontend Order Interface

```typescript
interface Order {
  id: number;
  reference_number: string;
  status: OrderStatus;
  delivery_type: string;
  payment_method: string;
  customer_name: string;
  delivery_address: string;
  total: string;
  notes: string;
  created_at: string;
  updated_at: string;
  items: {
    product_name: string;
    quantity: number;
    unit_price: string;
    toppings: { topping_name: string; additional_price: string }[];
  }[];
}
```

## Error Handling

### WebSocket Errors

| Scenario | Behavior |
|----------|----------|
| Invalid/missing JWT token | Close connection with code 4001 |
| Invalid restaurant slug | Close connection with code 4004 |
| Redis unavailable | Consumer fails to join group, connection closes |
| Connection drops | Frontend reconnects with exponential backoff |

### REST API Errors (existing)

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Invalid status transition | 409 | `invalid_transition` |
| Order not found | 404 | `not_found` |
| Unauthorized | 401 | `token_expired` |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Status to color mapping is total and correct

*For any* valid order status, the color mapping function SHALL return the expected hex color: received→#EF4444, confirmed→#F97316, in_preparation→#EAB308, completed→#22C55E, cancelled→#6B7280.

**Validates: Requirements 1.2**

### Property 2: Orders are sorted by arrival time ascending

*For any* list of orders with distinct creation timestamps, the sort function SHALL produce a list where each order's `created_at` is less than or equal to the next order's `created_at`.

**Validates: Requirements 1.4**

### Property 3: Elapsed time computation correctness

*For any* order creation timestamp and current time where current > created, the elapsed time function SHALL return a non-negative integer equal to the floor of the difference in minutes between the two times.

**Validates: Requirements 1.5**

### Property 4: Available actions determined by state machine

*For any* order status, the advance button is enabled if and only if a valid next status exists (received→confirmed, confirmed→in_preparation, in_preparation→completed), and the cancel button is enabled if and only if the status is in {received, confirmed, in_preparation}.

**Validates: Requirements 2.1, 2.3, 2.5**

### Property 5: JWT rejection on invalid token

*For any* WebSocket connection attempt where the provided token is absent, malformed, or expired, the KitchenConsumer SHALL reject the connection with close code 4001.

**Validates: Requirements 3.1, 6.4**

### Property 6: Restaurant group name derivation is deterministic

*For any* restaurant slug, the Channel Layer group name SHALL always be exactly `kitchen_{slug}`.

**Validates: Requirements 3.3**

### Property 7: Exponential backoff delay computation

*For any* reconnection attempt number N (N ≥ 0), the computed delay SHALL equal min(2^N × 1000, 30000) milliseconds.

**Validates: Requirements 3.4**

### Property 8: Filter correctness

*For any* list of orders and any combination of status filters and delivery type filters, the filtered result SHALL contain exactly those orders whose status is in the selected statuses AND whose delivery type is in the selected delivery types.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 9: Filter persistence round-trip

*For any* valid filter configuration (statuses subset and delivery types subset), storing it to localStorage and reading it back SHALL produce an identical configuration.

**Validates: Requirements 4.4**

### Property 10: Order card content completeness

*For any* order with populated fields, the rendered Order Card SHALL include: reference number, item list with toppings, delivery type, delivery address (when delivery type is "delivery"), payment method, arrival time, and elapsed time counter.

**Validates: Requirements 5.1**
