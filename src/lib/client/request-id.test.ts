import {afterEach,expect,it,vi} from 'vitest';
import {createRequestId} from './request-id';
afterEach(()=>vi.unstubAllGlobals());
it('uses the native secure UUID when supported',()=>{const uuid='1471e159-b3be-4e8c-9e8a-001122334455';vi.stubGlobal('crypto',{randomUUID:()=>uuid});expect(createRequestId()).toBe(uuid);});
it('creates a valid UUID v4 with Web Crypto when HTTP has no randomUUID',()=>{const random=vi.fn((bytes:Uint8Array)=>{bytes.fill(255);return bytes;});vi.stubGlobal('crypto',{getRandomValues:random});expect(createRequestId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');expect(random).toHaveBeenCalledTimes(1);});
it('does not manufacture insecure IDs when Web Crypto is unavailable',()=>{vi.stubGlobal('crypto',{});expect(()=>createRequestId()).toThrow();});
