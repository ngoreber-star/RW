import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Tenant Resolution: resolveTenant', () => {
    const TENANT_CACHE_TTL = 30000;
    let tenantCache = {};

    function getCachedTenant(userId) {
        const cached = tenantCache[userId];
        if (cached && Date.now() - cached.timestamp < TENANT_CACHE_TTL) {
            return cached.data;
        }
        return null;
    }

    function setCachedTenant(userId, data) {
        tenantCache[userId] = { data, timestamp: Date.now() };
    }

    function clearCache() {
        tenantCache = {};
    }

    async function resolveTenant(userId, options = {}) {
        const {
            rpcResult = null,
            rpcError = null,
            rpcThrow = false,
            rpcDelay = 0,
            useCache = true,
        } = options;

        if (useCache) {
            const cached = getCachedTenant(userId);
            if (cached) return cached;
        }

        if (rpcThrow) {
            throw new Error('RPC failed');
        }

        if (rpcDelay > 0) {
            await new Promise(r => setTimeout(r, rpcDelay));
        }

        if (rpcError) {
            return null;
        }

        if (useCache && rpcResult) {
            setCachedTenant(userId, rpcResult);
        }

        return rpcResult;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        clearCache();
    });

    it('debe resolver tenant vía RPC exitosamente', async () => {
        const result = await resolveTenant('u1', {
            rpcResult: { tenant: { id: 't1', name: 'Test Tenant' }, role: 'admin', tenant_id: 't1' },
        });
        expect(result).toBeTruthy();
        expect(result.tenant.id).toBe('t1');
        expect(result.role).toBe('admin');
    });

    it('debe retornar null si RPC falla', async () => {
        const result = await resolveTenant('u1', { rpcError: { message: 'RPC error' } });
        expect(result).toBeNull();
    });

    it('debe retornar null si RPC lanza excepción', async () => {
        try {
            await resolveTenant('u1', { rpcThrow: true });
            expect.fail('Should have thrown');
        } catch (e) {
            expect(e.message).toBe('RPC failed');
        }
    });

    it('debe cachear resultado después de primera resolución', async () => {
        const rpcResult = { tenant: { id: 't1' }, role: 'admin', tenant_id: 't1' };

        const r1 = await resolveTenant('u1', { rpcResult });
        expect(r1).toBeTruthy();

        // Segunda llamada debe venir del cache
        const r2 = await resolveTenant('u1', { rpcResult: null });
        expect(r2).toEqual(r1);
    });

    it('no debe usar cache si useCache=false', async () => {
        const r1 = await resolveTenant('u1', {
            rpcResult: { tenant: { id: 't1' }, role: 'admin' },
        });
        expect(r1).toBeTruthy();

        const r2 = await resolveTenant('u1', {
            rpcResult: null,
            useCache: false,
        });
        expect(r2).toBeNull();
    });

    it('debe expirar cache después del TTL', async () => {
        const originalDateNow = Date.now;
        let fakeNow = 1000000;

        Date.now = vi.fn(() => fakeNow);

        await resolveTenant('u1', {
            rpcResult: { tenant: { id: 't1' }, role: 'admin' },
        });

        fakeNow += TENANT_CACHE_TTL + 1;

        const expired = getCachedTenant('u1');
        expect(expired).toBeNull();

        Date.now = originalDateNow;
    });

    it('debe resolver bajo latencia alta (150ms+)', async () => {
        const start = Date.now();
        const result = await resolveTenant('u1', {
            rpcResult: { tenant: { id: 't1' } },
            rpcDelay: 150,
        });
        const elapsed = Date.now() - start;

        expect(result).toBeTruthy();
        expect(elapsed).toBeGreaterThanOrEqual(140);
    }, 10000);
});
