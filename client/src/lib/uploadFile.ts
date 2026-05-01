import { getAccessToken, setAccessTokenExternal } from "./auth-context";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
] as const;

export type AllowedDocumentMime = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

export function isAllowedDocumentMime(mime: string): mime is AllowedDocumentMime {
  return (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime);
}

export interface UploadOptions {
  url: string;
  file: File;
  fields?: Record<string, string>;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface UploadResult<T = unknown> {
  status: number;
  body: T;
}

class HttpUploadError extends Error {
  status: number;
  serverMessage?: string;
  constructor(status: number, message: string, serverMessage?: string) {
    super(message);
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

let inflightRefresh: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (inflightRefresh) {
    return inflightRefresh;
  }
  inflightRefresh = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAccessTokenExternal(data.accessToken);
        return data.accessToken as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

function performXhrUpload<T>(
  token: string | null,
  { url, file, fields, onProgress, signal }: UploadOptions,
): Promise<UploadResult<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        formData.append(k, v);
      }
    }

    xhr.open("POST", url, true);
    xhr.withCredentials = true;
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          onProgress(pct);
        }
      };
    }

    const onAbort = () => {
      try {
        xhr.abort();
      } catch {
        /* noop */
      }
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.onload = () => {
      const status = xhr.status;
      let body: unknown = null;
      const raw = xhr.responseText;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        body = raw;
      }
      if (status >= 200 && status < 300) {
        resolve({ status, body: body as T });
        return;
      }
      const serverMessage =
        body && typeof body === "object" && "error" in (body as Record<string, unknown>)
          ? String((body as Record<string, unknown>).error)
          : typeof body === "string"
            ? body
            : undefined;
      reject(new HttpUploadError(status, serverMessage || `HTTP ${status}`, serverMessage));
    };

    xhr.onerror = () => reject(new HttpUploadError(0, "Error de red"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));

    xhr.send(formData);
  });
}

export async function uploadFileWithProgress<T = unknown>(opts: UploadOptions): Promise<UploadResult<T>> {
  const token = getAccessToken();
  try {
    return await performXhrUpload<T>(token, opts);
  } catch (err) {
    if (err instanceof HttpUploadError && err.status === 401) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        return performXhrUpload<T>(newToken, opts);
      }
    }
    throw err;
  }
}

export function describeUploadError(err: unknown): string {
  if (err instanceof HttpUploadError) {
    if (err.serverMessage) return err.serverMessage;
    if (err.status === 401) return "Sesión expirada, inicia sesión de nuevo";
    if (err.status === 413) return "El archivo supera 10 MB";
    if (err.status === 415) return "Tipo de archivo no permitido";
    return `Error ${err.status}`;
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return "Subida cancelada";
  }
  if (err instanceof Error) return err.message;
  return "Error desconocido";
}
