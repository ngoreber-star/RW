import { describe, it, expect } from 'vitest';

describe('Conflict Resolution: _resolveConflict', () => {
    async function resolveConflict(localPayload, remoteRow) {
        const localTime = new Date(localPayload.updated_at || 0).getTime();
        const remoteTime = new Date(remoteRow.updated_at || remoteRow.created_at || 0).getTime();
        return localTime >= remoteTime ? localPayload : remoteRow;
    }

    it('debe devolver local cuando local.updated_at > remote.updated_at', async () => {
        const local = { id: '1', name: 'Producto A', price: 100, updated_at: '2025-01-01T10:00:00Z' };
        const remote = { id: '1', name: 'Producto A', price: 90, updated_at: '2025-01-01T09:00:00Z' };
        expect(await resolveConflict(local, remote)).toEqual(local);
    });

    it('debe devolver remote cuando remote.updated_at > local.updated_at', async () => {
        const local = { id: '1', name: 'Producto A', price: 100, updated_at: '2025-01-01T09:00:00Z' };
        const remote = { id: '1', name: 'Producto A', price: 110, updated_at: '2025-01-01T10:00:00Z' };
        expect(await resolveConflict(local, remote)).toEqual(remote);
    });

    it('debe devolver local cuando timestamps son iguales (local wins on tie)', async () => {
        const local = { id: '1', name: 'Producto A', price: 100, updated_at: '2025-01-01T10:00:00Z' };
        const remote = { id: '1', name: 'Producto B', price: 110, updated_at: '2025-01-01T10:00:00Z' };
        expect(await resolveConflict(local, remote)).toEqual(local);
    });

    it('debe devolver local cuando remote no tiene updated_at ni created_at', async () => {
        const local = { id: '1', name: 'Producto A', price: 100, updated_at: '2025-01-01T10:00:00Z' };
        const remote = { id: '1', name: 'Producto A', price: 90 };
        expect(await resolveConflict(local, remote)).toEqual(local);
    });

    it('debe devolver remote cuando local no tiene updated_at', async () => {
        const local = { id: '1', name: 'Producto A', price: 100 };
        const remote = { id: '1', name: 'Producto A', price: 90, updated_at: '2025-01-01T10:00:00Z' };
        expect(await resolveConflict(local, remote)).toEqual(remote);
    });

    it('debe perder local si clock skew de -5 minutos atrasa local', async () => {
        const now = new Date('2025-01-01T10:00:00Z').getTime();
        const future = now + 5 * 60 * 1000;
        const local = { id: '1', name: 'Editado local', updated_at: new Date(now).toISOString() };
        const remote = { id: '1', name: 'Editado remoto', updated_at: new Date(future).toISOString() };
        expect(await resolveConflict(local, remote)).toEqual(remote);
    });

    it('debe ganar local si clock skew de +5 minutos adelanta local', async () => {
        const now = new Date('2025-01-01T10:00:00Z').getTime();
        const past = now - 5 * 60 * 1000;
        const local = { id: '1', name: 'Editado local', updated_at: new Date(now).toISOString() };
        const remote = { id: '1', name: 'Editado remoto', updated_at: new Date(past).toISOString() };
        expect(await resolveConflict(local, remote)).toEqual(local);
    });

    it('debe ganar remote si remote.updated_at es string ISO y local es timestamp numérico', async () => {
        const local = { id: '1', name: 'A', updated_at: 1735689600000 };
        const remote = { id: '1', name: 'B', updated_at: '2025-01-01T10:00:00Z' };
        expect(await resolveConflict(local, remote)).toEqual(remote);
    });

    it('debe devolver remote si local.updated_at es 0 (falsy)', async () => {
        const local = { id: '1', name: 'A', updated_at: 0 };
        const remote = { id: '1', name: 'B', updated_at: '2025-01-01T10:00:00Z' };
        expect(await resolveConflict(local, remote)).toEqual(remote);
    });

    it('debe tratar created_at como fallback cuando falta updated_at', async () => {
        const local = { id: '1', name: 'A', updated_at: '2025-01-01T10:00:00Z' };
        const remote = { id: '1', name: 'B', created_at: '2025-01-01T09:00:00Z' };
        expect(await resolveConflict(local, remote)).toEqual(local);
    });
});
