/**
 * RIVER-WALL ERP V.5.0 - Supabase Client
 * Offline-first data layer with optimistic UI
 * Adapted from Lake-Wall architecture
 *
 * Usage:
 *   const { supabase, dataStore } = await initSupabaseClient();
 *   await dataStore.syncTable('products', tenantId);
 *   dataStore.subscribeRealtime('products', tenantId, (payload) => console.log(payload));
 */

(function (global) {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================

    const SUPABASE_CONFIG = {
        URL: localStorage.getItem('sb_url') || window.ENV?.SUPABASE?.URL || 'https://YOUR_PROJECT.supabase.co',
        ANON_KEY: localStorage.getItem('sb_anon_key') || window.ENV?.SUPABASE?.ANON_KEY || 'YOUR_ANON_KEY',
    };

    const CONFIG = {
        SYNC_DEBOUNCE_MS: 2000,
        SYNC_BATCH_SIZE: 100,
        REALTIME_EVENTS_PER_SEC: 10,
        MAX_RETRY_ATTEMPTS: 5,
        RETRY_BACKOFF_MS: 3000,
        OFFLINE_AUTH_KEY: 'rw_offline_credentials',
        OFFLINE_SESSION_KEY: 'rw_offline_session',
        CACHE_PREFIX: 'rw_cache_',
        SYNC_QUEUE_KEY: 'rw_sync_queue',
        LOCAL_ONLY_TABLES: ['kitchenOrders', 'kitchen_orders', 'accountingEntries', 'accountingAccounts', 'accountingConfigs', 'users'], // Never sync to cloud (users handled via RPC)
    };

    // AES-GCM encryption via RWSecurity (ISO 27001 A.10.1.1)
    // Falls back to plain storage if crypto unavailable
    async function secureSetItem(key, value) {
        try {
            if (global.RWSecurity?.secureSetItem) {
                await global.RWSecurity.secureSetItem(key, value);
            } else {
                localStorage.setItem(key, JSON.stringify(value));
            }
        } catch { localStorage.setItem(key, JSON.stringify(value)); }
    }

    async function secureGetItem(key) {
        try {
            if (global.RWSecurity?.secureGetItem) {
                return await global.RWSecurity.secureGetItem(key);
            }
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    // Force HTTPS for Supabase connections (ISO 27001 A.13.1.1)
    function enforceHTTPS(url) {
        if (!url) return url;
        return url.replace(/^http:\/\//i, 'https://').replace(/^ws:\/\//i, 'wss://');
    }

    const TABLE_MAP = {
        warehouseStock: 'warehouse_stock',
        posTerminals: 'pos_terminals',
        posTerminalClosures: 'pos_terminal_closures',
        loyaltyCards: 'loyalty_cards',
        walletTransactions: 'wallet_transactions',
        crmCoupons: 'crm_coupons',
        crmCouponPurchases: 'crm_coupon_purchases',
        reloadRequests: 'reload_requests',
        discountCampaigns: 'discount_campaigns',
        crmActivities: 'crm_activities',
        accountingAccounts: 'accounting_accounts',
        accountingEntries: 'accounting_entries',
        inventoryMovements: 'inventory_movements',
        pendingTickets: 'pending_tickets',
        audit: 'audit_logs',
    };

    function getSupabaseTableName(localName) {
        return TABLE_MAP[localName] || localName;
    }

    // ============================================================
    // SUPABASE CLIENT INITIALIZATION
    // ============================================================

    let supabase = null;

    function createSupabaseClient() {
        if (!window.supabase) {
            console.error('[Supabase] SDK not loaded. Ensure <script src="vendor/supabase.js"> is present.');
            return null;
        }
        try {
            const client = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true,
                },
                realtime: {
                    params: {
                        eventsPerSecond: CONFIG.REALTIME_EVENTS_PER_SEC,
                    },
                },
            });
            console.log('[Supabase] Client initialized');
            return client;
        } catch (err) {
            console.error('[Supabase] Failed to create client:', err);
            return null;
        }
    }

    function configureSupabase(url, anonKey) {
        SUPABASE_CONFIG.URL = enforceHTTPS(url);
        SUPABASE_CONFIG.ANON_KEY = anonKey;
        localStorage.setItem('sb_url', url);
        localStorage.setItem('sb_anon_key', anonKey);
        supabase = createSupabaseClient();
        return supabase;
    }

    // ============================================================
    // OFFLINE AUTH (SHA-256 + PIN)
    // ============================================================

    const OfflineAuth = {
        async hash(str) {
            const buf = new TextEncoder().encode(str);
            const hashBuf = await crypto.subtle.digest('SHA-256', buf);
            return Array.from(new Uint8Array(hashBuf))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        },

        async register(email, password, pin, userData = {}) {
            const passwordHash = await this.hash(password);
            const pinHash = pin ? await this.hash(pin) : null;
            const creds = {
                email: email.toLowerCase().trim(),
                passwordHash,
                pinHash,
                userData,
                createdAt: Date.now(),
            };
            let all = secureGetItem(CONFIG.OFFLINE_AUTH_KEY) || [];
            if (!Array.isArray(all)) all = [];
            const idx = all.findIndex(u => u.email === creds.email);
            if (idx >= 0) {
                all[idx] = creds; // Update existing
            } else {
                all.push(creds); // Add new
            }
            secureSetItem(CONFIG.OFFLINE_AUTH_KEY, all);
            return creds;
        },

        async login(email, password, pin = null) {
            let all = secureGetItem(CONFIG.OFFLINE_AUTH_KEY) || [];
            if (!Array.isArray(all)) all = [];
            const user = all.find(u => u.email === email.toLowerCase().trim());
            if (!user) return null;
            const passwordHash = await this.hash(password);
            if (user.passwordHash !== passwordHash) return null;
            if (pin && user.pinHash) {
                const pinHash = await this.hash(pin);
                if (user.pinHash !== pinHash) return null;
            }
            const session = {
                email: user.email,
                userData: user.userData,
                loggedInAt: Date.now(),
                expiresAt: Date.now() + (8 * 60 * 60 * 1000), // 8 hours
            };
            secureSetItem(CONFIG.OFFLINE_SESSION_KEY, session);
            return session;
        },

        getSession() {
            const session = secureGetItem(CONFIG.OFFLINE_SESSION_KEY);
            if (!session) return null;
            if (Date.now() > session.expiresAt) {
                localStorage.removeItem(CONFIG.OFFLINE_SESSION_KEY);
                return null;
            }
            return session;
        },

        logout() {
            localStorage.removeItem(CONFIG.OFFLINE_SESSION_KEY);
        },

        markSynced(email) {
            let all = secureGetItem(CONFIG.OFFLINE_AUTH_KEY) || [];
            if (!Array.isArray(all)) all = [];
            const idx = all.findIndex(u => u.email === email.toLowerCase().trim());
            if (idx >= 0) {
                all[idx].syncedAt = Date.now();
                secureSetItem(CONFIG.OFFLINE_AUTH_KEY, all);
            }
        },
    };

    // ============================================================
    // SUPABASE DATA STORE (Offline-first + Sync Queue)
    // ============================================================

    // Convert camelCase keys → snake_case for Supabase tables.
    // Only top-level keys are converted; nested objects (metadata, items, etc.) are left intact.
    function toSnake(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
        const overrides = {
            active: 'is_active',
            image: 'image_url',
            category: 'category_id',
            taxId: 'tax_id',
            minStock: 'min_stock',
            maxStock: 'max_stock',
            saleNumber: 'sale_number',
            purchaseNumber: 'purchase_number',
            posTerminalId: 'pos_terminal_id',
            localeId: 'locale_id',
            warehouseId: 'warehouse_id',
            fromWarehouseId: 'from_warehouse_id',
            toWarehouseId: 'to_warehouse_id',
            productId: 'product_id',
            clientId: 'client_id',
            supplierId: 'supplier_id',
            userId: 'user_id',
            createdBy: 'created_by',
            updatedBy: 'updated_by',
            batchId: 'batch_id',
            completedAt: 'completed_at',
            openedAt: 'opened_at',
            closedAt: 'closed_at',
            expectedAmount: 'expected_amount',
            openingAmount: 'opening_amount',
            closingAmount: 'closing_amount',
            differenceAmount: 'difference_amount',
            salesCount: 'sales_count',
            salesTotal: 'sales_total',
            paymentTotals: 'payment_totals',
            currentSession: 'current_session',
            pinHash: 'pin_hash',
            isOwner: 'is_owner',
            isDefault: 'is_default',
            isPublicStore: 'is_public_store',
            isDelivery: 'is_delivery',
            deliveryAddress: 'delivery_address',
            deliveryStatus: 'delivery_status',
            deliveryPerson: 'delivery_person',
            estimatedTime: 'estimated_time',
            paymentMethod: 'payment_method',
            paymentDetails: 'payment_details',
            customerName: 'customer_name',
            customerPhone: 'customer_phone',
            customerEmail: 'customer_email',
            balanceAfter: 'balance_after',
            trackingCode: 'tracking_code',
            serviceTypes: 'service_types',
            storeName: 'store_name',
            orderCode: 'order_code',
            cardNumber: 'card_number',
            loyaltyCardNumber: 'loyalty_card_number',
            loyaltyPoints: 'loyalty_points',
            walletBalance: 'wallet_balance',
            creditLimit: 'credit_limit',
            totalCredit: 'total_credit',
            firstName: 'first_name',
            lastName: 'last_name',
            businessName: 'business_name',
            taxId: 'tax_id',
            logoUrl: 'logo_url',
            plan: 'plan',
            status: 'status',
            settings: 'settings',
            syscohadaEnabled: 'syscohada_enabled',
            class: 'class_id',
        };
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'id' || key === 'tenant_id' || key === 'user_id' || key.startsWith('_')) {
                result[key] = value;
                continue;
            }
            const snake = overrides[key] || key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            result[snake] = value;
        }
        return result;
    }

    // Convert snake_case keys → camelCase for frontend consumption.
    const TO_CAMEL_OVERRIDES = {
        class_id: 'class',
    };

    function toCamel(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'id' || key === 'tenant_id' || key === 'user_id' || key.startsWith('_')) {
                result[key] = value;
                continue;
            }
            const camel = TO_CAMEL_OVERRIDES[key] || key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            result[camel] = value;
        }
        return result;
    }

    class SupabaseDataStore {
        constructor(supabaseClient) {
            this.supabase = supabaseClient;
            this.cache = {};
            this.subscriptions = {};
            this.syncTimer = null;
            this.isOnline = navigator.onLine;
            this.currentTenantId = null;
            this.currentUserId = null;
            this.syncInProgress = false;

            // Listen for online/offline
            window.addEventListener('online', () => { this.isOnline = true; this.processSyncQueue(); });
            window.addEventListener('offline', () => { this.isOnline = false; });
        }

        // --- Cache helpers ---

        _cacheKey(table) {
            return `${CONFIG.CACHE_PREFIX}${this.currentTenantId || 'default'}_${table}`;
        }

        _loadCache(table) {
            const key = this._cacheKey(table);
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
        }

        _saveCache(table, data) {
            const key = this._cacheKey(table);
            try {
                localStorage.setItem(key, JSON.stringify(data));
            } catch (e) {
                console.warn('[DataStore] localStorage full, pruning old tables');
                // Simple prune: remove oldest cache entries
                this._pruneCache();
                try { localStorage.setItem(key, JSON.stringify(data)); } catch (e2) {}
            }
        }

        _pruneCache() {
            const keys = Object.keys(localStorage).filter(k => k.startsWith(CONFIG.CACHE_PREFIX));
            keys.sort(); // naive: alphabetical
            const toRemove = keys.slice(0, Math.ceil(keys.length * 0.2));
            toRemove.forEach(k => localStorage.removeItem(k));
        }

        // --- Sync Queue ---

        _loadQueue() {
            try {
                return JSON.parse(localStorage.getItem(CONFIG.SYNC_QUEUE_KEY) || '[]');
            } catch { return []; }
        }

        _saveQueue(queue) {
            localStorage.setItem(CONFIG.SYNC_QUEUE_KEY, JSON.stringify(queue));
        }

        enqueue(table, operation, payload) {
            const queue = this._loadQueue();
            queue.push({
                id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
                table,
                operation, // 'insert', 'update', 'delete'
                payload,
                tenantId: this.currentTenantId,
                createdAt: Date.now(),
                attempts: 0,
            });
            this._saveQueue(queue);
            this.scheduleSync();
        }

        scheduleSync() {
            if (this.syncTimer) clearTimeout(this.syncTimer);
            this.syncTimer = setTimeout(() => this.processSyncQueue(), CONFIG.SYNC_DEBOUNCE_MS);
        }

        async processSyncQueue() {
            if (!this.isOnline || !this.supabase || this.syncInProgress) return;
            const queue = this._loadQueue();
            if (!queue.length) return;

            this.syncInProgress = true;
            console.log(`[DataStore] Processing ${queue.length} queued operations...`);

            const remaining = [];
            for (const op of queue) {
                if (op.attempts >= CONFIG.MAX_RETRY_ATTEMPTS) {
                    console.warn('[DataStore] Discarding failed op after max retries:', op);
                    continue;
                }
                try {
                    await this._executeRemoteOp(op);
                    console.log('[DataStore] Synced:', op.operation, op.table);
                } catch (err) {
                    console.warn('[DataStore] Sync failed for op:', op, err.message);
                    op.attempts++;
                    remaining.push(op);
                }
            }

            this._saveQueue(remaining);
            this.syncInProgress = false;

            if (remaining.length) {
                setTimeout(() => this.processSyncQueue(), CONFIG.RETRY_BACKOFF_MS);
            }
        }

        async _resolveConflict(table, localPayload, remoteRow) {
            // Estrategia: el que tenga updated_at más reciente gana
            const localTime = new Date(localPayload.updated_at || 0).getTime();
            const remoteTime = new Date(remoteRow.updated_at || remoteRow.created_at || 0).getTime();
            return localTime >= remoteTime ? localPayload : remoteRow;
        }

        async _executeRemoteOp(op) {
            if (!this.supabase) throw new Error('No supabase client');
            const sbTable = getSupabaseTableName(op.table);
            const tbl = this.supabase.from(sbTable);

            if (op.operation === 'insert') {
                const payload = toSnake({ ...op.payload, tenant_id: op.tenantId });
                const { error } = await tbl.insert(payload);
                if (error) throw error;
            } else if (op.operation === 'update') {
                const { id, ...rest } = op.payload;
                // Intentar obtener el registro remoto para resolver conflictos
                const { data: remote } = await tbl.select('updated_at, created_at').eq('id', id).eq('tenant_id', op.tenantId).maybeSingle();
                if (remote) {
                    const resolved = await this._resolveConflict(op.table, rest, remote);
                    if (resolved === remote) {
                        // El remoto es más reciente → no sobreescribir, actualizar caché local
                        console.log('[DataStore] Conflicto resuelto: versión remota más reciente para', id);
                        const fullRemote = await tbl.select('*').eq('id', id).eq('tenant_id', op.tenantId).maybeSingle();
                        if (fullRemote?.data) {
                            const cached = this._loadCache(op.table);
                            const idx = cached.findIndex(i => i.id === id);
                            if (idx >= 0) {
                                cached[idx] = toCamel(fullRemote.data);
                                this._saveCache(op.table, cached);
                            }
                        }
                        return;
                    }
                }
                const payload = toSnake(rest);
                const { error } = await tbl.update(payload).eq('id', id).eq('tenant_id', op.tenantId);
                if (error) throw error;
            } else if (op.operation === 'delete') {
                const { error } = await tbl.delete().eq('id', op.payload.id).eq('tenant_id', op.tenantId);
                if (error) throw error;
            }
        }

        // --- CRUD Operations (Local-first) ---

        setTenant(tenantId, userId) {
            this.currentTenantId = tenantId;
            this.currentUserId = userId;
        }

        getAll(table) {
            return this._loadCache(table);
        }

        getById(table, id) {
            return this.getAll(table).find(item => item.id === id);
        }

        insert(table, payload, syncToCloud = true) {
            if (!payload.id) payload.id = crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
            const data = this._loadCache(table);
            data.push(payload);
            this._saveCache(table, data);

            if (syncToCloud && !CONFIG.LOCAL_ONLY_TABLES.includes(table)) {
                if (this.isOnline && this.supabase) {
                    this.enqueue(table, 'insert', payload);
                }
            }
            // Audit log (ISO 27001 A.12.4.1)
            if (global.RWSecurity?.logAudit) {
                global.RWSecurity.logAudit('INSERT', {
                    userId: this.currentUserId,
                    tenantId: this.currentTenantId,
                    resource: table,
                    resourceId: payload.id,
                    metadata: { syncToCloud },
                });
            }
            return payload;
        }

        update(table, id, changes, syncToCloud = true) {
            const data = this._loadCache(table);
            const idx = data.findIndex(item => item.id === id);
            if (idx === -1) return null;
            data[idx] = { ...data[idx], ...changes, updated_at: new Date().toISOString() };
            this._saveCache(table, data);

            if (syncToCloud && !CONFIG.LOCAL_ONLY_TABLES.includes(table)) {
                if (this.isOnline && this.supabase) {
                    this.enqueue(table, 'update', data[idx]);
                }
            }
            // Audit log (ISO 27001 A.12.4.1)
            if (global.RWSecurity?.logAudit) {
                global.RWSecurity.logAudit('UPDATE', {
                    userId: this.currentUserId,
                    tenantId: this.currentTenantId,
                    resource: table,
                    resourceId: id,
                    metadata: { changes: Object.keys(changes) },
                });
            }
            return data[idx];
        }

        delete(table, id, syncToCloud = true) {
            const data = this._loadCache(table).filter(item => item.id !== id);
            this._saveCache(table, data);

            if (syncToCloud && !CONFIG.LOCAL_ONLY_TABLES.includes(table)) {
                if (this.isOnline && this.supabase) {
                    this.enqueue(table, 'delete', { id });
                }
            }
            // Audit log (ISO 27001 A.12.4.1)
            if (global.RWSecurity?.logAudit) {
                global.RWSecurity.logAudit('DELETE', {
                    userId: this.currentUserId,
                    tenantId: this.currentTenantId,
                    resource: table,
                    resourceId: id,
                });
            }
            return true;
        }

        upsert(table, payload, syncToCloud = true) {
            const existing = this.getById(table, payload.id);
            if (existing) {
                return this.update(table, payload.id, payload, syncToCloud);
            } else {
                return this.insert(table, payload, syncToCloud);
            }
        }

        // --- Bulk Sync from Supabase ---

        async syncTable(table, tenantId, options = {}) {
            if (!this.supabase) return [];
            const { filter = {}, orderBy = 'created_at', ascending = false } = options;

            const sbTable = getSupabaseTableName(table);
            let query = this.supabase
                .from(sbTable)
                .select('*')
                .eq('tenant_id', tenantId);

            // Apply extra filters
            Object.entries(filter).forEach(([col, val]) => {
                query = query.eq(col, val);
            });

            query = query.order(orderBy, { ascending });

            const { data, error } = await query;
            if (error) {
                console.warn(`[DataStore] Failed to sync ${table}:`, error.message);
                return this._loadCache(table);
            }

            const rows = (data || []).map(row => {
                const camel = toCamel(row);
                // Remap Supabase fields to frontend expectations for specific tables
                if (table === 'sales') {
                    if (!camel.ticket && camel.saleNumber) camel.ticket = camel.saleNumber;
                    if (!camel.date && camel.createdAt) camel.date = camel.createdAt;
                    if (!camel.clientName && row.client_name) camel.clientName = row.client_name;
                }
                return camel;
            });
            this._saveCache(table, rows);
            console.log(`[DataStore] Synced ${table}: ${rows.length} rows`);
            return rows;
        }

        async syncAllTables(tenantId, tables = []) {
            const defaultTables = [
                'categories','products','clients','locales','sales','purchases',
                'suppliers','warehouses','warehouseStock','taxes',
                'loyalty_cards','wallet_transactions','crm_coupons',
                'discount_campaigns','pos_terminals','transfers'
            ];
            const toSync = tables.length ? tables : defaultTables;
            const results = {};
            for (const table of toSync) {
                results[table] = await this.syncTable(table, tenantId);
            }
            return results;
        }

        // --- Realtime Subscriptions ---

        subscribeRealtime(table, tenantId, callback) {
            if (!this.supabase || !this.supabase.channel) {
                console.warn('[DataStore] Realtime not available');
                return { unsubscribe: () => {} };
            }

            const sbTable = getSupabaseTableName(table);
            const channelName = `${table}:${tenantId}`;
            if (this.subscriptions[channelName]) {
                this.subscriptions[channelName].unsubscribe();
            }

            const channel = this.supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: sbTable,
                        filter: `tenant_id=eq.${tenantId}`,
                    },
                    (payload) => {
                        this._handleRealtimeChange(table, payload);
                        if (callback) callback(payload);
                        // Dispatch custom event for legacy code
                        window.dispatchEvent(new CustomEvent('supabase-realtime', {
                            detail: { table, payload },
                        }));
                    }
                )
                .subscribe((status) => {
                    console.log(`[Realtime] ${table} status:`, status);
                });

            this.subscriptions[channelName] = channel;
            return channel;
        }

        _handleRealtimeChange(table, payload) {
            const cache = this._loadCache(table);
            const { eventType, new: newRecord, old: oldRecord } = payload;

            if (eventType === 'INSERT') {
                const rec = toCamel(newRecord);
                const exists = cache.find(item => item.id === rec.id);
                if (!exists) cache.push(rec);
            } else if (eventType === 'UPDATE') {
                const rec = toCamel(newRecord);
                const idx = cache.findIndex(item => item.id === rec.id);
                if (idx >= 0) cache[idx] = rec;
                else cache.push(rec);
            } else if (eventType === 'DELETE') {
                const rec = toCamel(oldRecord);
                const idx = cache.findIndex(item => item.id === rec.id);
                if (idx >= 0) cache.splice(idx, 1);
            }

            this._saveCache(table, cache);
        }

        unsubscribeAll() {
            Object.values(this.subscriptions).forEach(ch => ch?.unsubscribe?.());
            this.subscriptions = {};
        }

        // --- Utilities ---

        clearCache(table) {
            if (table) {
                localStorage.removeItem(this._cacheKey(table));
            } else {
                Object.keys(localStorage)
                    .filter(k => k.startsWith(CONFIG.CACHE_PREFIX))
                    .forEach(k => localStorage.removeItem(k));
            }
        }

        getStats() {
            const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith(CONFIG.CACHE_PREFIX));
            const queue = this._loadQueue();
            return {
                cachedTables: cacheKeys.length,
                queueLength: queue.length,
                isOnline: this.isOnline,
                tenantId: this.currentTenantId,
            };
        }
    }

    // ============================================================
    // AUTH MANAGER
    // ============================================================

    class AuthManager {
        constructor(supabaseClient) {
            this.supabase = supabaseClient;
            this.currentUser = null;
            this.currentTenant = null;
            this.currentRole = null;
        }

        async signUp(email, password, userData = {}) {
            if (!this.supabase) return { error: new Error('Supabase not initialized') };
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: { data: userData },
            });
            return { data, error };
        }

        async signIn(email, password) {
            if (!this.supabase) {
                // Fallback to offline auth
                const session = await OfflineAuth.login(email, password);
                return { session, offline: true };
            }

            const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
            if (error) {
                // Try offline fallback
                const offlineSession = await OfflineAuth.login(email, password);
                if (offlineSession) return { session: offlineSession, offline: true };
                return { error };
            }

            this.currentUser = data.user;

            // Resolve tenant
            let tenant = await this.resolveTenant(data.user.id);

            // Auto-create tenant if user is orphaned (no tenant link)
            if (!tenant && this.supabase) {
                try {
                    const businessName = data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Mi Negocio';
                    const { data: createData, error: createErr } = await this.supabase
                        .rpc('create_tenant_for_user', {
                            p_user_id: data.user.id,
                            p_business_name: businessName,
                            p_email: data.user.email,
                            p_plan: 'lite'
                        });
                    if (!createErr && createData != null) {
                        // createData may be a scalar UUID or an array wrapping it
                        const createdId = Array.isArray(createData) ? createData[0] : createData;
                        console.log('[AuthManager] Tenant creation RPC returned:', createdId);

                        // Re-resolve tenant (with fallback tables) after creation
                        tenant = await this.resolveTenant(data.user.id);

                        // If the RPC created the tenant row but did not link tenant_users,
                        // manually insert the linkage (RLS allows user_id = auth.uid())
                        if (!tenant && createdId) {
                            try {
                                const { error: linkErr } = await this.supabase
                                    .from('tenant_users')
                                    .insert({
                                        user_id: data.user.id,
                                        tenant_id: createdId,
                                        role: 'admin',
                                        is_owner: true
                                    });
                                if (!linkErr) {
                                    console.log('[AuthManager] Manually linked user to tenant:', createdId);
                                    tenant = await this.resolveTenant(data.user.id);
                                } else {
                                    console.warn('[AuthManager] Manual tenant link failed:', linkErr);
                                }
                            } catch (e) {
                                console.warn('[AuthManager] Exception during manual tenant link:', e);
                            }
                        }

                        // If resolveTenant still can't see the row (possible read-replica lag
                        // or RLS quirk), read the tenant directly by its ID and build the object.
                        if (!tenant && createdId) {
                            try {
                                const { data: tenantRow, error: tErr } = await this.supabase
                                    .from('tenants')
                                    .select('*')
                                    .eq('id', createdId)
                                    .maybeSingle();
                                if (!tErr && tenantRow) {
                                    console.log('[AuthManager] Built tenant from direct read:', tenantRow.id);
                                    tenant = { ...tenantRow, role: 'admin', tenant_id: createdId };
                                } else if (tErr) {
                                    console.warn('[AuthManager] Direct tenant read error:', tErr);
                                }
                            } catch (e) {
                                console.warn('[AuthManager] Exception during direct tenant read:', e);
                            }
                        }

                        // Last resort: retry resolveTenant after a short delay (read-replica catch-up)
                        if (!tenant && createdId) {
                            await new Promise(r => setTimeout(r, 600));
                            tenant = await this.resolveTenant(data.user.id);
                            if (tenant) console.log('[AuthManager] Tenant resolved after delay:', tenant.id);
                        }

                        if (tenant) {
                            console.log('[AuthManager] Auto-created tenant resolved:', tenant.id);
                        } else {
                            console.warn('[AuthManager] Tenant creation RPC succeeded but tenant not found. Data:', createData);
                        }
                    } else if (createErr) {
                        console.warn('[AuthManager] Auto-create tenant RPC error:', createErr);
                    }
                } catch (e) {
                    console.warn('[AuthManager] Auto-create tenant failed:', e);
                }
            }

            if (!tenant) {
                await this.signOut();
                return { error: new Error('Usuario no asignado a ningún negocio. Contacte al administrador o cree un negocio desde el panel superadmin.') };
            }

            this.currentTenant = tenant;

            // Cache offline credentials for future offline login
            await OfflineAuth.register(email, password, null, { id: data.user.id, email });
            OfflineAuth.markSynced(email);

            return { user: data.user, tenant, session: data.session };
        }

        async signOut() {
            OfflineAuth.logout();
            if (this.supabase) {
                await this.supabase.auth.signOut();
            }
            this.currentUser = null;
            this.currentTenant = null;
            this.currentRole = null;
        }

        async resolveTenant(userId) {
            if (!this.supabase) return null;

            // 1. Try RPC to bypass RLS policies that may block direct table reads
            try {
                const { data: result, error: rpcErr } = await this.supabase
                    .rpc('get_user_tenant', { p_user_id: userId });

                if (!rpcErr && result) {
                    // Defensive: Supabase may return JSONB as a string in some versions
                    const parsed = (typeof result === 'string') ? JSON.parse(result) : result;
                    if (parsed && parsed.tenant) {
                        this.currentRole = parsed.role;
                        return { ...parsed.tenant, role: parsed.role };
                    }
                }
            } catch (e) {
                console.warn('[AuthManager] get_user_tenant RPC exception:', e);
            }

            // 2. Fallback: query tables directly (works if RLS policies allow self-read)
            try {
                const { data: tu, error: tuErr } = await this.supabase
                    .from('tenant_users')
                    .select('tenant_id, role')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (!tuErr && tu) {
                    const { data: tenant, error: tErr } = await this.supabase
                        .from('tenants')
                        .select('*')
                        .eq('id', tu.tenant_id)
                        .maybeSingle();
                    if (!tErr && tenant) {
                        this.currentRole = tu.role;
                        return { ...tenant, role: tu.role, tenant_id: tu.tenant_id };
                    }
                }
            } catch (e) {
                console.warn('[AuthManager] Direct tenant query failed:', e);
            }

            return null;
        }

        async getSession() {
            if (this.supabase) {
                const { data } = await this.supabase.auth.getSession();
                if (data?.session) return data.session;
            }
            return OfflineAuth.getSession();
        }

        onAuthStateChange(callback) {
            if (this.supabase) {
                return this.supabase.auth.onAuthStateChange((event, session) => {
                    callback(event, session);
                });
            }
            return { data: { subscription: { unsubscribe: () => {} } } };
        }
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    async function initSupabaseClient() {
        // Enable DOM protection (ISO 27001 A.14.2.5)
        if (global.RWSecurity?.enableSafeDOM) {
            global.RWSecurity.enableSafeDOM();
        }
        // Start session monitor (ISO 27001 A.9.4.2)
        if (global.RWSecurity?.initSessionMonitor) {
            global.RWSecurity.initSessionMonitor();
        }
        // Listen for session timeout
        window.addEventListener('session-timeout', () => {
            console.warn('[Supabase] Session expired due to inactivity');
            if (typeof global.forceLogout === 'function') global.forceLogout();
        });

        supabase = createSupabaseClient();
        const dataStore = new SupabaseDataStore(supabase);
        const auth = new AuthManager(supabase);

        // Check existing session
        const session = await auth.getSession();
        if (session?.user) {
            auth.currentUser = session.user;
            const tenant = await auth.resolveTenant(session.user.id);
            if (tenant) {
                auth.currentTenant = tenant;
                dataStore.setTenant(tenant.id, session.user.id);
            }
        }

        return {
            supabase,
            dataStore,
            auth,
            OfflineAuth,
            configureSupabase,
        };
    }

    // Expose globally
    global.SupabaseClient = {
        init: initSupabaseClient,
        configure: configureSupabase,
        OfflineAuth,
        CONFIG,
    };

})(window);
