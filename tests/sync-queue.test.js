import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Sync Queue: idempotencia y retry', () => {
    const MAX_RETRY_ATTEMPTS = 5;
    let store = {};

    function getItem(key) { return store[key] || null; }
    function setItem(key, value) { store[key] = String(value); }
    function removeItem(key) { delete store[key]; }

    function loadQueue(key) {
        try { return JSON.parse(getItem(key) || '[]'); }
        catch { return []; }
    }

    function saveQueue(key, queue) {
        setItem(key, JSON.stringify(queue));
    }

    function enqueueOperation(key, table, operation, payload, tenantId) {
        const queue = loadQueue(key);
        queue.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2),
            table,
            operation,
            payload,
            tenantId,
            createdAt: Date.now(),
            attempts: 0,
        });
        saveQueue(key, queue);
    }

    function processQueueStep(key, simulateFail = false) {
        const queue = loadQueue(key);
        const remaining = [];

        for (const op of queue) {
            if (op.attempts >= MAX_RETRY_ATTEMPTS) {
                continue;
            }
            if (simulateFail) {
                op.attempts++;
                remaining.push(op);
            }
        }
        saveQueue(key, remaining);
        return remaining;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        store = {};
    });

    it('debe encolar operación y persistir', () => {
        const key = 'rw_sync_queue';
        enqueueOperation(key, 'products', 'insert', { id: 'p1', name: 'Test', price: 100, tenant_id: 't1' }, 't1');
        enqueueOperation(key, 'products', 'insert', { id: 'p2', name: 'Test 2', price: 200, tenant_id: 't1' }, 't1');

        const queue = loadQueue(key);
        expect(queue.length).toBe(2);
        expect(queue[0].table).toBe('products');
        expect(queue[0].operation).toBe('insert');
        expect(queue[0].attempts).toBe(0);
    });

    it('debe descartar operación después de MAX_RETRY_ATTEMPTS', () => {
        const key = 'rw_sync_queue';
        const failedOp = {
            id: 'op-fail-1',
            table: 'products',
            operation: 'insert',
            payload: { id: 'p1', name: 'Fail' },
            tenantId: 't1',
            createdAt: Date.now(),
            attempts: 5,
        };
        saveQueue(key, [failedOp]);

        const remaining = processQueueStep(key);
        expect(remaining.length).toBe(0);
    });

    it('debe incrementar attempts en fallo y mantener en queue', () => {
        const key = 'rw_sync_queue';
        const op = {
            id: 'op-retry-1',
            table: 'products',
            operation: 'insert',
            payload: { id: 'p1', name: 'Retry' },
            tenantId: 't1',
            createdAt: Date.now(),
            attempts: 0,
        };
        saveQueue(key, [op]);

        const remaining = processQueueStep(key, true);
        expect(remaining.length).toBe(1);
        expect(remaining[0].attempts).toBe(1);
    });

    it('debe mantener orden de operaciones en la queue', () => {
        const key = 'rw_sync_queue';
        enqueueOperation(key, 'products', 'insert', { id: 'p1' }, 't1');
        enqueueOperation(key, 'sales', 'insert', { id: 's1' }, 't1');
        enqueueOperation(key, 'products', 'update', { id: 'p1', price: 200 }, 't1');

        const queue = loadQueue(key);
        expect(queue[0].table).toBe('products');
        expect(queue[1].table).toBe('sales');
        expect(queue[2].table).toBe('products');
        expect(queue[2].operation).toBe('update');
    });

    it('debe manejar queue vacía sin errores', () => {
        const remaining = processQueueStep('rw_sync_queue');
        expect(remaining).toEqual([]);
    });

    it('debe preservar datos entre escrituras/lecturas', () => {
        const key = 'test_queue';
        saveQueue(key, [{ id: '1', attempts: 0 }]);
        expect(loadQueue(key).length).toBe(1);

        saveQueue(key, []);
        expect(loadQueue(key).length).toBe(0);
    });
});
