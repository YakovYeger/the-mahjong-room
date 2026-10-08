import { NextResponse, type NextRequest } from 'next/server';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function noStoreJson(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

export async function readJson(request: NextRequest, maxBytes = 32_768): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request is too large.');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request is too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Send a valid JSON request.');
  }
}

export function requestSubject(request: NextRequest, suffix = '') {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('cf-connecting-ip') || 'unknown';
  return `${ip}:${suffix.toLowerCase().slice(0, 120)}`;
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) return noStoreJson({ error: { code: error.code, message: error.message } }, { status: error.status });
  console.error('Unhandled API error', error);
  return noStoreJson({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } }, { status: 500 });
}
