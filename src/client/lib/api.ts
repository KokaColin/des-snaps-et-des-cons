/** Appels à l'API du serveur (même origine, cookie de session envoyé automatiquement). */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly data: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; json?: unknown; body?: BodyInit } = {},
): Promise<T> {
  const init: RequestInit = { method: options.method ?? 'GET', credentials: 'same-origin' };
  if (options.json !== undefined) {
    init.body = JSON.stringify(options.json);
    init.headers = { 'Content-Type': 'application/json' };
  } else if (options.body !== undefined) {
    init.body = options.body;
  }
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError('network', 0);
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new ApiError(typeof data.error === 'string' ? data.error : 'server_error', response.status, data);
  return data as T;
}
