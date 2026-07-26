import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";

// Types

interface Order {
  id: string;
  reference_number: string;
  created_at: string;
  status: string;
  delivery_type: string;
  total: number | null;
  payment_method_type: string;
}

interface OrderItem {
  product_name: string;
  unit_price: number;
  notes: string;
  toppings: { name: string; extra_price: number }[];
}

interface OrderDetail extends Order {
  items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  received: "Recibido",
  confirmed: "Confirmado",
  in_preparation: "En preparación",
  completed: "Completado",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-800",
  confirmed: "bg-yellow-100 text-yellow-800",
  in_preparation: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const DELIVERY_LABELS: Record<string, string> = {
  delivery: "Domicilio",
  pickup: "Recoger",
  dine_in: "Mesa",
};

export default function OrderList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Detail view
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const url = `/orders/?${params.toString()}`;
      const res = await apiGet(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : data.results ?? []);
      } else {
        setError("Error al cargar pedidos.");
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  async function viewDetail(orderId: string) {
    setDetailLoading(true);
    try {
      const res = await apiGet(`/orders/${orderId}/`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
      }
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  }

  function handleFilter() {
    fetchOrders();
  }

  function clearFilters() {
    setFilterStatus("");
    setDateFrom("");
    setDateTo("");
    setTimeout(fetchOrders, 0);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("es-CO", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function formatPrice(price: number | null) {
    if (price === null) return "—";
    return `$${price.toLocaleString("es-CO")}`;
  }

  // Detail view
  if (selectedOrder) {
    return (
      <div>
        <button
          onClick={() => setSelectedOrder(null)}
          className="mb-4 text-sm text-orange-600 hover:text-orange-700 font-medium"
        >
          ← Volver a la lista
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Pedido #{selectedOrder.reference_number}
            </h2>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[selectedOrder.status] ?? "bg-gray-100 text-gray-800"}`}>
              {STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm text-gray-600">
            <div><strong>Fecha:</strong> {formatDate(selectedOrder.created_at)}</div>
            <div><strong>Tipo:</strong> {DELIVERY_LABELS[selectedOrder.delivery_type] ?? selectedOrder.delivery_type}</div>
            <div><strong>Pago:</strong> {selectedOrder.payment_method_type}</div>
            <div><strong>Total:</strong> {formatPrice(selectedOrder.total)}</div>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase">Productos</h3>
          <div className="space-y-3">
            {selectedOrder.items.map((item, idx) => (
              <div key={idx} className="border border-gray-100 rounded-md p-3">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900">{item.product_name}</span>
                  <span className="text-sm text-gray-600">{formatPrice(item.unit_price)}</span>
                </div>
                {item.notes && (
                  <p className="text-xs text-gray-500 mt-1 italic">Nota: {item.notes}</p>
                )}
                {item.toppings.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {item.toppings.map((t, tidx) => (
                      <li key={tidx} className="text-xs text-gray-500 flex justify-between">
                        <span>+ {t.name}</span>
                        <span>{formatPrice(t.extra_price)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md mb-4">{error}</p>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Todos</option>
            <option value="received">Recibido</option>
            <option value="confirmed">Confirmado</option>
            <option value="in_preparation">En preparación</option>
            <option value="completed">Completado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <button
          onClick={handleFilter}
          className="px-4 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700"
        >
          Filtrar
        </button>
        <button
          onClick={clearFilters}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Limpiar
        </button>
      </div>

      {/* Orders table */}
      {loading ? (
        <p className="text-sm text-gray-500">Cargando pedidos...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-400">No hay pedidos registrados.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Referencia</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Tipo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => viewDetail(order.id)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{order.reference_number}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-800"}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{DELIVERY_LABELS[order.delivery_type] ?? order.delivery_type}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatPrice(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailLoading && (
        <p className="text-sm text-gray-500 mt-4">Cargando detalle...</p>
      )}
    </div>
  );
}
