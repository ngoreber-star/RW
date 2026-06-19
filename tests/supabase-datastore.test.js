// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SupabaseDataStore API especifica', () => {
    let SupabaseDataStore;

    beforeEach(() => {
        vi.stubGlobal('crypto', {
            randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
        });
        vi.stubGlobal('navigator', { onLine: true });
        const store = {};
        vi.stubGlobal('localStorage', {
            getItem: (key) => store[key] || null,
            setItem: (key, value) => { store[key] = String(value); },
            removeItem: (key) => { delete store[key]; },
        });
        window.ENV = { SUPABASE: { URL: 'https://test.supabase.co', ANON_KEY: 'test-key' } };
        vi.resetModules();
    });

    it('debe exponer los 9 métodos específicos en el prototype', async () => {
        await import('../supabase-client.js');
        SupabaseDataStore = window.SupabaseDataStore;
        const ds = new SupabaseDataStore(null);
        expect(typeof ds.getProducts).toBe('function');
        expect(typeof ds.saveProduct).toBe('function');
        expect(typeof ds.deleteProduct).toBe('function');
        expect(typeof ds.getSales).toBe('function');
        expect(typeof ds.saveSale).toBe('function');
        expect(typeof ds.getClients).toBe('function');
        expect(typeof ds.saveClient).toBe('function');
        expect(typeof ds.getWarehouses).toBe('function');
        expect(typeof ds.saveWarehouse).toBe('function');
        expect(typeof ds.syncOfflineQueue).toBe('function');
    });

    it('debe lanzar error si falta tenantId en métodos específicos', async () => {
        await import('../supabase-client.js');
        SupabaseDataStore = window.SupabaseDataStore;
        const ds = new SupabaseDataStore(null);
        await expect(ds.getProducts()).rejects.toThrow('tenantId requerido');
        await expect(ds.saveProduct(null, {})).rejects.toThrow('tenantId requerido');
        await expect(ds.deleteProduct(null, 'p1')).rejects.toThrow('tenantId requerido');
        await expect(ds.getSales()).rejects.toThrow('tenantId requerido');
        await expect(ds.saveSale(null, {})).rejects.toThrow('tenantId requerido');
        await expect(ds.getClients()).rejects.toThrow('tenantId requerido');
        await expect(ds.saveClient(null, {})).rejects.toThrow('tenantId requerido');
        await expect(ds.getWarehouses()).rejects.toThrow('tenantId requerido');
        await expect(ds.saveWarehouse(null, {})).rejects.toThrow('tenantId requerido');
    });
});
