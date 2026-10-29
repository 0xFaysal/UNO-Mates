/** Database clients may throw plain objects rather than Error instances. Never expose details or credentials. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
 if (typeof error === 'string' && error.trim() && error !== '[object Object]') return error;
 if (error && typeof error === 'object') {
  const value = error as { message?: unknown; code?: unknown };
  if (value.code === '23505') return 'Your room or seat changed. Please try again.';
  if (typeof value.message === 'string' && value.message.trim() && value.message !== '[object Object]') return value.message;
 }
 return fallback;
}
