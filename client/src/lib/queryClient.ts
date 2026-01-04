import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAccessToken } from "./auth-context";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function tryRefreshToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      const retryHeaders: Record<string, string> = {
        Authorization: `Bearer ${newToken}`,
      };
      if (data) {
        retryHeaders["Content-Type"] = "application/json";
      }
      res = await fetch(url, {
        method,
        headers: retryHeaders,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    }
  }

  await throwIfResNotOk(res);
  return res;
}

function buildUrl(queryKey: readonly unknown[]): string {
  const urlParts: string[] = [];
  let queryParams: Record<string, string> | null = null;

  for (const key of queryKey) {
    if (typeof key === "string") {
      urlParts.push(key);
    } else if (typeof key === "object" && key !== null && !Array.isArray(key)) {
      queryParams = key as Record<string, string>;
    }
  }

  let url = urlParts.join("/");
  
  if (queryParams) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null) {
        params.append(k, String(v));
      }
    }
    const paramString = params.toString();
    if (paramString) {
      url += `?${paramString}`;
    }
  }

  return url;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = buildUrl(queryKey);
    
    let res = await fetch(url, {
      headers: getAuthHeaders(),
      credentials: "include",
    });

    if (res.status === 401) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${newToken}` },
          credentials: "include",
        });
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
