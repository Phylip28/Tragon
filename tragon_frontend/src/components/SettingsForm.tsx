import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api";

// Types

interface RestaurantProfile {
  name: string;
  address_line: string;
  delivery_fee: string;
  logo_url: string | null;
}

interface PaymentMethod {
  id: number;
  type: "cash" | "transfer" | "transfer_with_key";
  key_value: string;
  is_active: boolean;
}

type PaymentMethodType = PaymentMethod["type"];

const PAYMENT_TYPE_LABELS: Record<PaymentMethodType, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  transfer_with_key: "Transferencia con clave",
};

// Main component

export default function SettingsForm() {
  // Profile state
  const [profile, setProfile] = useState<RestaurantProfile>({
    name: "",
    address_line: "",
    delivery_fee: "",
    logo_url: null,
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  // Logo upload state
  const [logoUploading, setLogoUploading] = useState(false);

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [pmLoading, setPmLoading] = useState(true);
  const [pmError, setPmError] = useState("");

  // Payment method form state
  const [showPmForm, setShowPmForm] = useState(false);
  const [editingPm, setEditingPm] = useState<PaymentMethod | null>(null);
  const [pmFormType, setPmFormType] = useState<PaymentMethodType>("cash");
  const [pmFormKeyValue, setPmFormKeyValue] = useState("");
  const [pmFormIsActive, setPmFormIsActive] = useState(true);
  const [pmFormSaving, setPmFormSaving] = useState(false);
  const [pmFormError, setPmFormError] = useState("");

  // Load profile and payment methods on mount
  useEffect(() => {
    fetchProfile();
    fetchPaymentMethods();
  }, []);

  // --- Profile ---

  async function fetchProfile() {
    setProfileLoading(true);
    try {
      const res = await apiGet("/restaurants/me/");
      if (res.ok) {
        const data = await res.json();
        setProfile({
          name: data.name ?? "",
          address_line: data.address_line ?? "",
          delivery_fee: data.delivery_fee ?? "",
          logo_url: data.logo_url ?? null,
        });
      } else {
        setProfileError("No se pudo cargar el perfil.");
      }
    } catch {
      setProfileError("Error de conexión.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage("");
    setProfileError("");

    try {
      const res = await apiPatch("/restaurants/me/", {
        name: profile.name,
        address_line: profile.address_line,
        delivery_fee: profile.delivery_fee,
      });

      if (res.ok) {
        setProfileMessage("Perfil actualizado correctamente.");
      } else {
        const data = await res.json();
        setProfileError(data.detail ?? "Error al guardar los cambios.");
      }
    } catch {
      setProfileError("Error de conexión.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setProfileError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiPost("/restaurants/me/upload-logo/", formData);

      if (res.ok) {
        const data = await res.json();
        setProfile((prev) => ({ ...prev, logo_url: data.logo_url }));
        setProfileMessage("Logo actualizado correctamente.");
      } else {
        setProfileError("Error al subir el logo.");
      }
    } catch {
      setProfileError("Error de conexión al subir el logo.");
    } finally {
      setLogoUploading(false);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    }
  }

  // --- Payment Methods ---

  async function fetchPaymentMethods() {
    setPmLoading(true);
    try {
      const res = await apiGet("/restaurants/me/payment-methods/");
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(Array.isArray(data) ? data : data.results ?? []);
      } else {
        setPmError("No se pudieron cargar los métodos de pago.");
      }
    } catch {
      setPmError("Error de conexión.");
    } finally {
      setPmLoading(false);
    }
  }

  function openAddPmForm() {
    setEditingPm(null);
    setPmFormType("cash");
    setPmFormKeyValue("");
    setPmFormIsActive(true);
    setPmFormError("");
    setShowPmForm(true);
  }

  function openEditPmForm(pm: PaymentMethod) {
    setEditingPm(pm);
    setPmFormType(pm.type);
    setPmFormKeyValue(pm.key_value ?? "");
    setPmFormIsActive(pm.is_active);
    setPmFormError("");
    setShowPmForm(true);
  }

  function closePmForm() {
    setShowPmForm(false);
    setEditingPm(null);
    setPmFormError("");
  }

  async function handlePmFormSubmit(e: FormEvent) {
    e.preventDefault();
    setPmFormSaving(true);
    setPmFormError("");

    const body: Record<string, unknown> = {
      type: pmFormType,
      is_active: pmFormIsActive,
    };

    if (pmFormType === "transfer_with_key") {
      body.key_value = pmFormKeyValue;
    } else {
      body.key_value = "";
    }

    try {
      let res: Response;
      if (editingPm) {
        res = await apiPatch(`/restaurants/me/payment-methods/${editingPm.id}/`, body);
      } else {
        res = await apiPost("/restaurants/me/payment-methods/", body);
      }

      if (res.ok) {
        closePmForm();
        fetchPaymentMethods();
      } else {
        const data = await res.json();
        setPmFormError(data.detail ?? data.type?.[0] ?? "Error al guardar.");
      }
    } catch {
      setPmFormError("Error de conexión.");
    } finally {
      setPmFormSaving(false);
    }
  }

  async function handleDeletePm(pm: PaymentMethod) {
    if (!confirm(`¿Eliminar método de pago "${PAYMENT_TYPE_LABELS[pm.type]}"?`)) return;

    try {
      const res = await apiDelete(`/restaurants/me/payment-methods/${pm.id}/`);
      if (res.ok || res.status === 204) {
        fetchPaymentMethods();
      } else {
        setPmError("Error al eliminar el método de pago.");
      }
    } catch {
      setPmError("Error de conexión.");
    }
  }

  // --- Render ---

  if (profileLoading) {
    return <p className="text-gray-500">Cargando configuración...</p>;
  }

  return (
    <div className="space-y-8">
      {/* Profile Section */}
      <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Perfil del restaurante</h2>

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          {/* Logo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
            <div className="flex items-center gap-4">
              {profile.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt="Logo del restaurante"
                  className="w-16 h-16 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                  <span className="text-gray-400 text-xs">Sin logo</span>
                </div>
              )}
              <label className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                {logoUploading ? "Subiendo..." : "Cambiar logo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={logoUploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              id="name"
              type="text"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Address */}
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Dirección
            </label>
            <input
              id="address"
              type="text"
              value={profile.address_line}
              onChange={(e) => setProfile((p) => ({ ...p, address_line: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Delivery Fee */}
          <div>
            <label htmlFor="delivery_fee" className="block text-sm font-medium text-gray-700 mb-1">
              Tarifa de envío
            </label>
            <input
              id="delivery_fee"
              type="number"
              step="0.01"
              min="0"
              value={profile.delivery_fee}
              onChange={(e) => setProfile((p) => ({ ...p, delivery_fee: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Messages */}
          {profileMessage && (
            <p className="text-sm text-green-600 bg-green-50 p-3 rounded-md">{profileMessage}</p>
          )}
          {profileError && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{profileError}</p>
          )}

          <button
            type="submit"
            disabled={profileSaving}
            className="px-4 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {profileSaving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </section>

      {/* Payment Methods Section */}
      <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Métodos de pago</h2>
          <button
            type="button"
            onClick={openAddPmForm}
            className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            Agregar
          </button>
        </div>

        {pmError && (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md mb-4">{pmError}</p>
        )}

        {pmLoading ? (
          <p className="text-gray-500 text-sm">Cargando métodos de pago...</p>
        ) : paymentMethods.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay métodos de pago configurados.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {paymentMethods.map((pm) => (
              <li key={pm.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">
                    {PAYMENT_TYPE_LABELS[pm.type] ?? pm.type}
                  </span>
                  {pm.type === "transfer_with_key" && pm.key_value && (
                    <span className="ml-2 text-sm text-gray-500">({pm.key_value})</span>
                  )}
                  {!pm.is_active && (
                    <span className="ml-2 text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">
                      Inactivo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditPmForm(pm)}
                    className="text-sm text-orange-600 hover:text-orange-700"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePm(pm)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Payment Method Add/Edit Form */}
        {showPmForm && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              {editingPm ? "Editar método de pago" : "Agregar método de pago"}
            </h3>
            <form onSubmit={handlePmFormSubmit} className="space-y-3">
              <div>
                <label htmlFor="pm_type" className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  id="pm_type"
                  value={pmFormType}
                  onChange={(e) => setPmFormType(e.target.value as PaymentMethodType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="transfer_with_key">Transferencia con clave</option>
                </select>
              </div>

              {pmFormType === "transfer_with_key" && (
                <div>
                  <label htmlFor="pm_key" className="block text-sm font-medium text-gray-700 mb-1">
                    Clave de transferencia
                  </label>
                  <input
                    id="pm_key"
                    type="text"
                    value={pmFormKeyValue}
                    onChange={(e) => setPmFormKeyValue(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  id="pm_active"
                  type="checkbox"
                  checked={pmFormIsActive}
                  onChange={(e) => setPmFormIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="pm_active" className="text-sm text-gray-700">
                  Activo
                </label>
              </div>

              {pmFormError && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{pmFormError}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pmFormSaving}
                  className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pmFormSaving ? "Guardando..." : editingPm ? "Actualizar" : "Agregar"}
                </button>
                <button
                  type="button"
                  onClick={closePmForm}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
