import {fetchWithTimeout as fetch} from './network';
import { errorMessage } from '@/lib/errors';
export interface RoomCredentials { accessToken: string; expiresAt: number; roomTopic: string; playerTopic: string; controlTopic: string; playerId: string;protocol?:2;legacySeat?:boolean }
export class RoomAccessError extends Error { constructor(message: string, readonly status: number) { super(message); } }
const saved = new Map<string, RoomCredentials>();
const pending = new Map<string, Promise<RoomCredentials>>();
const generations = new Map<string, number>();
export function forgetRoomCredentials(code: string): void {
  saved.delete(code); pending.delete(code);
  generations.set(code, (generations.get(code) || 0) + 1);
}
export function getRoomCredentials(code: string): Promise<RoomCredentials> {
  const cached = saved.get(code);
  if (cached?.controlTopic && cached.expiresAt * 1000 > Date.now() + 90000) return Promise.resolve(cached);
  const existing = pending.get(code);
  if (existing) return existing;
  const generation = generations.get(code) || 0;
  const request = fetch('/api/rooms/' + code + '/realtime', { method: 'POST',headers:{'X-UNO-Realtime-Protocol':'2'} }).then(async response => {
    const data = await response.json();
    if (!response.ok) throw new RoomAccessError(errorMessage(data.error, 'Could not connect to the room.'), response.status);
    if ((generations.get(code) || 0) === generation) saved.set(code, data);
    return data as RoomCredentials;
  }).finally(() => { if (pending.get(code) === request) pending.delete(code); });
  pending.set(code, request);
  return request;
}
