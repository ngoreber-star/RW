/**
 * RIVER-WALL ERP V.5.0 - Disaster Recovery Script
 * ISO 27001 A.12.3.1 / A.17.1.2
 *
 * Usage:
 *   1. Load this script in the browser console on any page that has SupabaseClient loaded
 *   2. Or include as <script src="scripts/disaster-recovery.js"></script> in software.html
 *
 * Functions available via window.RWRecovery:
 *   - exportAllData()      → Download JSON backup of all local data
 *   - importAllData(file)  → Upload JSON backup to restore local data
 *   - verifySyncStatus()   → Check which tables are synced vs pending
 *   - forceResyncAll()     → Force re-sync all tables from Supabase
 *   - clearAndRestore()    → Clear local data and restore from Supabase
 */

(function(global) {
    'use strict';

    if (global.RWRecovery) return;

    const RWRecovery = {};

    // ================================================================
    // EXPORT: Backup all local data to a JSON file
    // ================================================================

    async function exportAllData() {
        const backup = {
            exportedAt: new Date().toISOString(),
            appVersion: window.ENV?.APP?.version || 'unknown',
            data: {},
            metadata: {},
        };

        // Export all cache tables
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith('rw_cache_')) {
                try {
                    backup.data[key] = JSON.parse(localStorage.getItem(key));
                } catch (e) {
                    backup.data[key] = localStorage.getItem(key);
                }
            }
        }

        // Export sync queue
        try {
            backup.metadata.syncQueue = JSON.parse(localStorage.getItem('rw_sync_queue') || '[]');
        } catch (e) {}

        // Export offline credentials (redacted)
        try {
            const creds = JSON.parse(localStorage.getItem('rw_offline_credentials') || '[]');
            backup.metadata.offlineUsers = creds.map(u => ({
                email: u.email,
                createdAt: u.createdAt,
                syncedAt: u.syncedAt,
            }));
        } catch (e) {}

        // Export offline session info (no secrets)
        try {
            const session = JSON.parse(localStorage.getItem('rw_offline_session') || '{}');
            if (session.email) {
                backup.metadata.lastSession = {
                    email: session.email,
                    loggedInAt: session.loggedInAt,
                    expiresAt: session.expiresAt,
                };
            }
        } catch (e) {}

        // Export tenant info
        try {
            backup.metadata.tenant = JSON.parse(localStorage.getItem('rw_offline_tenant') || '{}');
        } catch (e) {}

        // Export audit queue
        try {
            backup.metadata.auditQueue = JSON.parse(localStorage.getItem('rw_audit_queue') || '[]');
        } catch (e) {}

        // Create downloadable file
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rw-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[Recovery] Export completed:', Object.keys(backup.data).length, 'tables exported');
        return backup;
    }

    // ================================================================
    // IMPORT: Restore local data from a JSON backup file
    // ================================================================

    async function importAllData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const backup = JSON.parse(e.target.result);
                    if (!backup.data || !backup.exportedAt) {
                        reject(new Error('Formato de backup inválido'));
                        return;
                    }

                    let restored = 0;
                    for (const [key, value] of Object.entries(backup.data)) {
                        localStorage.setItem(key, JSON.stringify(value));
                        restored++;
                    }

                    if (backup.metadata?.syncQueue) {
                        localStorage.setItem('rw_sync_queue', JSON.stringify(backup.metadata.syncQueue));
                    }
                    if (backup.metadata?.tenant) {
                        localStorage.setItem('rw_offline_tenant', JSON.stringify(backup.metadata.tenant));
                    }

                    console.log('[Recovery] Import completed:', restored, 'tables restored');
                    resolve({ restored, tables: Object.keys(backup.data) });
                } catch (err) {
                    reject(new Error('Error al parsear backup: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Error al leer archivo'));
            reader.readAsText(file);
        });
    }

    // ================================================================
    // VERIFY: Check sync status of all local tables
    // ================================================================

    async function verifySyncStatus() {
        const status = {
            tables: {},
            pendingOperations: 0,
            isOnline: navigator.onLine,
            supabaseConnected: false,
        };

        // Check Supabase connection
        try {
            if (global.SupabaseClient) {
                const pkg = await global.SupabaseClient.init().catch(() => null);
                if (pkg?.supabase) {
                    const { data, error } = await pkg.supabase.from('tenants').select('id').limit(1);
                    status.supabaseConnected = !error && !!data;
                }
            }
        } catch (e) {}

        // Check each cached table
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith('rw_cache_')) {
                const tableName = key.replace('rw_cache_', '');
                try {
                    const data = JSON.parse(localStorage.getItem(key) || '[]');
                    const count = Array.isArray(data) ? data.length : 1;
                    const lastUpdated = Array.isArray(data) && data.length > 0
                        ? (data[data.length - 1]?.updated_at || data[data.length - 1]?.created_at || 'unknown')
                        : 'empty';
                    status.tables[tableName] = { count, lastUpdated };
                } catch (e) {
                    status.tables[tableName] = { count: 0, lastUpdated: 'error' };
                }
            }
        }

        // Check pending sync operations
        try {
            const queue = JSON.parse(localStorage.getItem('rw_sync_queue') || '[]');
            status.pendingOperations = queue.length;
        } catch (e) {}

        return status;
    }

    // ================================================================
    // RESYNC: Force re-download all data from Supabase
    // ================================================================

    async function forceResyncAll() {
        if (!global.SupabaseClient) {
            console.error('[Recovery] SupabaseClient not available');
            return { error: 'SupabaseClient not initialized' };
        }

        const pkg = await global.SupabaseClient.init();
        if (!pkg?.dataStore) {
            return { error: 'DataStore not available' };
        }

        const tenantId = pkg.dataStore.currentTenantId;
        if (!tenantId) {
            return { error: 'No tenant configured' };
        }

        console.log('[Recovery] Starting full re-sync for tenant:', tenantId);

        // Clear local cache but keep credentials
        const keysToKeep = ['sb_url', 'sb_anon_key', 'rw_offline_tenant', 'rw_offline_session', 'rw_2fa_secrets'];
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith('rw_cache_') && !keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        }

        // Re-sync all tables
        const results = await pkg.dataStore.syncAllTables(tenantId);
        console.log('[Recovery] Re-sync completed:', results);

        return { success: true, tables: Object.keys(results) };
    }

    // ================================================================
    // CLEAR & RESTORE: Remove local data and re-download from cloud
    // ================================================================

    async function clearAndRestore() {
        if (!confirm('⚠️ Esto borrará TODOS los datos locales y los volverá a descargar de Supabase.\n¿Continuar?')) {
            return { cancelled: true };
        }

        const resyncResult = await forceResyncAll();
        if (resyncResult.error) {
            console.error('[Recovery] Clear & restore failed:', resyncResult.error);
            return resyncResult;
        }

        console.log('[Recovery] Clear & restore completed successfully');
        return resyncResult;
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    global.RWRecovery = Object.assign(RWRecovery, {
        exportAllData,
        importAllData,
        verifySyncStatus,
        forceResyncAll,
        clearAndRestore,
    });

    console.log('[Recovery] Disaster Recovery utilities loaded');
})(window);
