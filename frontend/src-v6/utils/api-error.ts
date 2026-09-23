interface ApiErrorShape {
  response?: { data?: { message?: unknown } };
  message?: unknown;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const shape = error as ApiErrorShape;
  const apiMessage = shape.response?.data?.message;
  if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
  if (typeof shape.message === 'string' && shape.message.trim()) return shape.message;
  return fallback;
}
