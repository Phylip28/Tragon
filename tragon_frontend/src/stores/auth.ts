import { atom, computed } from "nanostores";

const ACCESS_TOKEN_KEY = "tragon_access_token";
const REFRESH_TOKEN_KEY = "tragon_refresh_token";

const API_BASE = import.meta.env.PUBLIC_API_BASE ?? "http://localhost:8000/api/v1";

// Reactive stores for tokens
export const $accessToken = atom<string | null>(getStoredToken(ACCESS_TOKEN_KEY));
export const $refreshToken = atom<string | null>(getStoredToken(REFRESH_TOKEN_KEY));

// Computed authentication state
export const $isAuthenticated = computed($accessToken, (token) => token !== null);

// Helper to safely read from localStorage (SSR-safe)
function getStoredToken(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

// Set both tokens after login/register/refresh
export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  $accessToken.set(access);
  $refreshToken.set(refresh);
}

// Clear tokens and redirect to login
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  $accessToken.set(null);
  $refreshToken.set(null);
}

export function logout(): void {
  clearTokens();
  if (typeof window !== "undefined") {
    window.location.href = "/admin/login";
  }
}

// Flag to prevent concurrent refresh attempts
let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns true if refresh succeeded, false otherwise.
 * On failure, clears tokens and redirects to login.
 */
export async function refreshAccessToken(): Promise<boolean> {
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = $refreshToken.get();
    if (!refresh) {
      logout();
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!response.ok) {
        logout();
        return false;
      }

      const data = await response.json();
      setTokens(data.access, data.refresh ?? refresh);
      return true;
    } catch {
      logout();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
