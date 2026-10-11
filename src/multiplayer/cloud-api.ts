export class CloudApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export class ContractError extends Error {}
export const isAccessError = (error: unknown) => error instanceof CloudApiError && (error.status === 401 || error.status === 404 || (error.status === 403 && !['SEAT_CONTROLLED_BY_BOT', 'HOST_REQUIRED'].includes(error.code)));
export const isTransientError = (error: unknown) => !(error instanceof ContractError)
  && (!(error instanceof CloudApiError) || error.status === 408 || error.status === 429 || error.status >= 500);

export async function cloudJson(path: string, init: RequestInit = {}, request: typeof fetch = fetch, timeoutMs = 8000): Promise<unknown> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(new Error('The table request timed out.')), timeoutMs);
  const forward = () => timeout.abort(init.signal?.reason);
  if (init.signal?.aborted) forward();
  else init.signal?.addEventListener('abort', forward, { once: true });
  try {
    const response = await request(path, { ...init, cache: 'no-store', signal: timeout.signal });
    let body: unknown;
    try { body = await response.json(); }
    catch {
      if (!response.ok) throw new CloudApiError(response.status, 'REQUEST_FAILED', 'The table request failed.');
      throw new ContractError('The table returned an unreadable response.');
    }
    if (!response.ok) {
      const error = body && typeof body === 'object' && 'error' in body ? body.error as { code?: string; message?: string } : undefined;
      throw new CloudApiError(response.status, typeof error?.code === 'string' ? error.code : 'REQUEST_FAILED', typeof error?.message === 'string' ? error.message : 'The table request failed.');
    }
    return body;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', forward);
  }
}
