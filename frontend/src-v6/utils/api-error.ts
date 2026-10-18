interface ApiErrorShape {
  response?: { data?: { message?: unknown } };
  message?: unknown;
  isAxiosError?: unknown;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const shape = error as ApiErrorShape;
  const apiMessage = shape.response?.data?.message;
  if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
  // Axios' own text ("Network Error", "timeout of 30000ms exceeded", "Request failed…")
  // is English transport detail; the caller's fallback says what to do in Spanish.
  if (shape.isAxiosError === true) return fallback;
  if (typeof shape.message === 'string' && shape.message.trim()) return shape.message;
  return fallback;
}
