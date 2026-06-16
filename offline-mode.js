/**
 * RIVER-WALL ERP V.5.0 - Offline Mode Fallback
 * Creates a mock supabase object when CDN fails or device is offline
 */

(function (global) {
    'use strict';

    if (global.OFFLINE_MODE_INITIALIZED) return;
    global.OFFLINE_MODE_INITIALIZED = true;

    function createMockSupabase() {
        const mockTable = (tableName) => ({
            select: () => mockTable(tableName),
            insert: () => Promise.resolve({ data: [], error: null }),
            update: () => Promise.resolve({ data: [], error: null }),
            delete: () => Promise.resolve({ data: [], error: null }),
            eq: () => mockTable(tableName),
            neq: () => mockTable(tableName),
            gt: () => mockTable(tableName),
            gte: () => mockTable(tableName),
            lt: () => mockTable(tableName),
            lte: () => mockTable(tableName),
            like: () => mockTable(tableName),
            ilike: () => mockTable(tableName),
            is: () => mockTable(tableName),
            in: () => mockTable(tableName),
            contains: () => mockTable(tableName),
            containedBy: () => mockTable(tableName),
            rangeGt: () => mockTable(tableName),
            rangeGte: () => mockTable(tableName),
            rangeLt: () => mockTable(tableName),
            rangeLte: () => mockTable(tableName),
            rangeAdjacent: () => mockTable(tableName),
            overlaps: () => mockTable(tableName),
            textSearch: () => mockTable(tableName),
            match: () => mockTable(tableName),
            not: () => mockTable(tableName),
            or: () => mockTable(tableName),
            and: () => mockTable(tableName),
            filter: () => mockTable(tableName),
            order: () => mockTable(tableName),
            limit: () => mockTable(tableName),
            single: () => Promise.resolve({ data: null, error: { message: 'Offline mode' } }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            csv: () => Promise.resolve({ data: '', error: null }),
            then: (cb) => Promise.resolve({ data: [], error: null }).then(cb),
        });

        return {
            from: (tableName) => mockTable(tableName),
            rpc: () => Promise.resolve({ data: null, error: { message: 'Offline mode' } }),
            auth: {
                signUp: () => Promise.resolve({ data: null, error: { message: 'Offline mode' } }),
                signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Offline mode' } }),
                signInWithOtp: () => Promise.resolve({ data: null, error: { message: 'Offline mode' } }),
                signOut: () => Promise.resolve({ error: null }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                getSession: () => Promise.resolve({ data: { session: null } }),
                getUser: () => Promise.resolve({ data: { user: null } }),
            },
            channel: () => ({
                on: () => ({ subscribe: () => {} }),
                subscribe: () => {},
                unsubscribe: () => {},
            }),
            removeChannel: () => {},
            removeAllChannels: () => {},
        };
    }

    // If Supabase SDK fails to load, inject mock
    // Solo se activa si el SDK de Supabase no está disponible,
    // no para cualquier error que mencione "supabase"
    let supabaseCheckDone = false;
    function checkSupabaseLoaded() {
        if (supabaseCheckDone) return;
        supabaseCheckDone = true;
        if (!global.supabase || typeof global.supabase.createClient !== 'function') {
            console.warn('[OfflineMode] Supabase SDK not detected, injecting mock');
            global.supabase = { createClient: () => createMockSupabase() };
            showOfflineBanner();
        }
    }
    // Verifica después de que todos los scripts se carguen
    if (document.readyState === 'complete') {
        setTimeout(checkSupabaseLoaded, 3000);
    } else {
        window.addEventListener('load', () => setTimeout(checkSupabaseLoaded, 3000));
    }

    // Also provide manual fallback
    global.enableOfflineMode = function () {
        console.warn('[OfflineMode] Manual offline mode enabled');
        window.OFFLINE_MODE = true;
        if (!global.supabase) global.supabase = { createClient: () => createMockSupabase() };
    };

    // Show banner
    function showOfflineBanner() {
        if (document.getElementById('rw-offline-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'rw-offline-banner';
        banner.innerHTML = `
            <div style="position:fixed;bottom:0;left:0;right:0;background:#f59e0b;color:#fff;
                        padding:8px 16px;text-align:center;font-family:sans-serif;font-size:14px;
                        z-index:99999;">
                ⚠️ Modo offline activo. Los datos se sincronizarán cuando vuelva la conexión.
            </div>
        `;
        document.body.appendChild(banner);
    }

    window.addEventListener('offline', showOfflineBanner);
    if (!navigator.onLine) showOfflineBanner();

})(window);
