import {describe,it,expect} from 'vitest';
import {adminLoginSchema,adminPasswordSchema} from './admin-contract';
describe('owner credential policy',()=>{
 const change=(next:string,confirmation=next)=>adminPasswordSchema.safeParse({current:'Current-pass-123',next,confirmation});
 it('rejects passwords exceeding bcrypt’s byte limit instead of silently truncating them',()=>{
  expect(change('a'.repeat(73)).success).toBe(false);
  expect(change('界'.repeat(25)).success).toBe(false);
  expect(change('界'.repeat(24)).success).toBe(true);
  expect(adminLoginSchema.safeParse({username:'owner',password:'界'.repeat(25)}).success).toBe(false);
 });
 it('counts Unicode characters consistently with the database, not UTF-16 units',()=>{
  expect(change('😀'.repeat(6)).success).toBe(false);
  expect(change('😀'.repeat(12)).success).toBe(true);
 });
 it('requires matching confirmation and non-empty, bounded login credentials',()=>{
  expect(change('Long-password-123','different').success).toBe(false);
  expect(change('Long-password-123').success).toBe(true);
  expect(adminLoginSchema.safeParse({username:'owner',password:''}).success).toBe(false);
  expect(adminLoginSchema.safeParse({username:'x'.repeat(101),password:'Long-password-123'}).success).toBe(false);
 });
});
