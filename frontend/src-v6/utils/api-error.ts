interface ApiErrorShape {
  response?: {
    data?: {
      message?: unknown;
    };
  };
  message?: unknown;
}

function errorShape(error: unknown): ApiErrorShape | null {
  return error && typeof error === 'object' ? error as ApiErrorShape : null;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const shape = errorShape(error);
  const apiMessage = shape?.response?.data?.message;
  if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
  if (typeof shape?.message === 'string' && shape.message.trim()) return shape.message;
  return fallback;
}

export function isNetworkError(error: unknown): boolean {
  return !errorShape(error)?.response;
}
