const TOKEN_KEY = "auditforge_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    // Best-effort — don't block the UI if the server is unreachable
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore
    }
  }
  clearToken();
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // Don't set Content-Type for FormData — the browser must set the multipart boundary itself
  const isFormData = init.body instanceof FormData;
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    // Only redirect if we're in the browser and not already on /login
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
    }
  }

  return res;
}
