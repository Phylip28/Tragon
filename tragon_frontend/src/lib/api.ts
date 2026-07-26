import { $accessToken, refreshAccessToken, logout } from "@/stores/auth";

const API_BASE = import.meta.env.PUBLIC_API_BASE ?? "http://localhost:8000/api/v1";

type RequestOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

/**
 * Fetch wrapper that injects JWT Authorization header and handles
 * automatic token refresh on 401 responses.
 */
export async function api(
  endpoint: string,
  options: RequestOptions = {}
): Promise<Response> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    ...options.headers,
  };

  // Inject auth header if token is available
  const token = $accessToken.get();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Default Content-Type for non-FormData bodies
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  const response = await fetch(url, { ...options, headers });

  // On 401, attempt token refresh and retry the original request once
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      logout();
      return response;
    }

    // Retry with new token
    const newToken = $accessToken.get();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
    }

    return fetch(url, { ...options, headers });
  }

  return response;
}

// Convenience methods

export async function apiGet(
  endpoint: string,
  options: RequestOptions = {}
): Promise<Response> {
  return api(endpoint, { ...options, method: "GET" });
}

export async function apiPost(
  endpoint: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<Response> {
  return api(endpoint, {
    ...options,
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export async function apiPatch(
  endpoint: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<Response> {
  return api(endpoint, {
    ...options,
    method: "PATCH",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export async function apiDelete(
  endpoint: string,
  options: RequestOptions = {}
): Promise<Response> {
  return api(endpoint, { ...options, method: "DELETE" });
}
