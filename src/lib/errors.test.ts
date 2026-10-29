import { describe, it, expect } from 'vitest';
import { errorMessage } from './errors';
describe('Readable errors',()=>{
 it('reads a plain database error object',()=>expect(errorMessage({message:'Room is full',code:'P0001'})).toBe('Room is full'));
 it('reads JavaScript errors',()=>expect(errorMessage(new Error('Room not found'))).toBe('Room not found'));
 it('does not expose database constraint details',()=>expect(errorMessage({message:'duplicate key',code:'23505',details:'private session token'})).toBe('Your room or seat changed. Please try again.'));
 it.each([undefined,{},'[object Object]',{message:'[object Object]'}])('uses a readable fallback for %j',error=>expect(errorMessage(error,'Could not join the room.')).toBe('Could not join the room.'));
});
