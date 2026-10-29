export function normalizeLobbyName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}
export function isValidLobbyName(value: string): boolean {
  return value.length >= 1 && value.length <= 20 && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}
