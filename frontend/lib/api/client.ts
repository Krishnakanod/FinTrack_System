// FinTrack API client
// Per Spec-03 §1.2: attaches Bearer token, refreshes on 401, surfaces backend error shape.

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// Public endpoints that must NOT carry the Authorization header.
const PUBLIC_PATHS = new Set([
  "/api/v1/auth/signup",
  "/api/v1/auth/login",
  "/api/v1/auth/verify-otp",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/refresh",
]);

interface FetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip the 401-refresh-retry cycle (used internally by the refresh call itself). */
  _skipRefresh?: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

// Lazy import to avoid circular dependency at module load time.
let _getAccessToken: (() => string | null) | null = null;
let _setAccessToken: ((token: string) => void) | null = null;
let _clearAuth: (() => void) | null = null;

export function initAuthHooks(hooks: {
  getAccessToken: () => string | null;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
}) {
  _getAccessToken = hooks.getAccessToken;
  _setAccessToken = hooks.setAccessToken;
  _clearAuth = hooks.clearAuth;
}

async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {}, _skipRefresh = false } = options;

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    credentials: "include", // required for refresh_token httpOnly cookie
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  // Attach Bearer token for non-public endpoints.
  const token = _getAccessToken?.();
  if (token && !PUBLIC_PATHS.has(path)) {
    (config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, config);

  // 401 handling: silent refresh + retry once.
  if (response.status === 401 && !_skipRefresh && !PUBLIC_PATHS.has(path)) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry the original request with the new token.
      const newToken = _getAccessToken?.();
      if (newToken) {
        (config.headers as Record<string, string>)["Authorization"] = `Bearer ${newToken}`;
      }
      const retryResponse = await fetch(`${API_BASE_URL}${path}`, config);
      if (retryResponse.ok) {
        return (await retryResponse.json()) as T;
      }
      // If retry also fails, fall through to error handling.
      return handleError(retryResponse);
    }
    // Refresh failed — clear auth and redirect to login.
    _clearAuth?.();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return handleError(response);
  }

  if (!response.ok) {
    return handleError(response);
  }

  // 204 No Content has no body — return void instead of trying to parse JSON.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function tryRefreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) return false;

    const data = await response.json();
    if (data.access_token) {
      _setAccessToken?.(data.access_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function handleError(response: Response): Promise<never> {
  let error: ApiError;
  try {
    const body = await response.json();
    // Backend wraps errors in { detail: { error, message, details } } (HTTPException detail)
    // or sometimes returns the shape directly.
    if (body.detail && typeof body.detail === "object") {
      error = body.detail as ApiError;
    } else {
      error = body as ApiError;
    }
  } catch {
    error = {
      error: "UNKNOWN_ERROR",
      message: response.statusText || "An unexpected error occurred",
    };
  }
  throw error;
}

export { apiFetch, API_BASE_URL };
