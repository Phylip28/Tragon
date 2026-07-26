import { useState, type FormEvent } from "react";
import { apiPost } from "@/lib/api";
import { setTokens } from "@/stores/auth";

export default function RegisterForm() {
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError("");
    setLoading(true);

    try {
      const response = await apiPost("/auth/register/", {
        owner_name: ownerName,
        email,
        password,
        restaurant_name: restaurantName,
      });

      if (response.ok) {
        const data = await response.json();
        setTokens(data.tokens.access, data.tokens.refresh);
        window.location.href = "/admin/settings";
      } else {
        const data = await response.json();
        // Extract field-level errors from details (custom exception handler format)
        if (data.details && typeof data.details === "object" && Object.keys(data.details).length > 0) {
          const fieldErrors: Record<string, string[]> = {};
          for (const [key, val] of Object.entries(data.details)) {
            fieldErrors[key] = Array.isArray(val) ? val : [String(val)];
          }
          setErrors(fieldErrors);
        } else if (data.message) {
          setGeneralError(data.message);
        } else if (data.detail) {
          setGeneralError(data.detail);
        } else {
          setGeneralError("Ocurrió un error inesperado.");
        }
      }
    } catch {
      setGeneralError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="owner_name" className="block text-sm font-medium text-gray-700 mb-1">
          Nombre del propietario
        </label>
        <input
          id="owner_name"
          type="text"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Juan Pérez"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        {errors.owner_name && (
          <p className="mt-1 text-sm text-red-600">{errors.owner_name.join(", ")}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.join(", ")}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-600">{errors.password.join(", ")}</p>
        )}
      </div>

      <div>
        <label htmlFor="restaurant_name" className="block text-sm font-medium text-gray-700 mb-1">
          Nombre del restaurante
        </label>
        <input
          id="restaurant_name"
          type="text"
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
          placeholder="Mi Restaurante"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        {errors.restaurant_name && (
          <p className="mt-1 text-sm text-red-600">{errors.restaurant_name.join(", ")}</p>
        )}
      </div>

      {generalError && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{generalError}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Registrando..." : "Crear cuenta"}
      </button>

      <p className="text-center text-sm text-gray-600">
        ¿Ya tienes cuenta?{" "}
        <a href="/admin/login" className="text-orange-600 hover:text-orange-700 font-medium">
          Inicia sesión
        </a>
      </p>
    </form>
  );
}
