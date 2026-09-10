export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function hrmsApiUrl(url: string) {
  if (url.startsWith("/api/hr/") || url.startsWith("/api/auth")) return url;
  if (url.startsWith("/api/")) return `/api/hr${url.slice(4)}`;
  return url;
}

export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(hrmsApiUrl(url), {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const json: ApiResponse<T> = contentType.includes("application/json")
    ? await res.json()
    : ({} as ApiResponse<T>);

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Request failed");
  }

  if (json.data === undefined) {
    throw new Error("Invalid API response");
  }

  return json.data;
}

export async function fetchApiArray<T>(
  url: string,
  options?: RequestInit
): Promise<T[]> {
  const data = await fetchApi<T[] | null>(url, options);
  return data ?? [];
}
