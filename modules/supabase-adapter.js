/**
 * RIVER-WALL ERP V.5.0 - Supabase Adapter
 * Monkey-patches DataStore, UIController and AppController to use Supabase
 */

(function (global) {
    'use strict';
    if (global.__SUPABASE_ADAPTER_LOADED__) return;
    global.__SUPABASE_ADAPTER_LOADED__ = true;

    // Dependencies are already loaded because scripts are synchronous
    const supabasePkg = global.SupabaseClient;
    if (!supabasePkg) {
        console.error('[Adapter] SupabaseClient not found');
        return;
    }

    // Initialize Supabase immediately (sync init, async connect later)
    let _supabase = null;
    let _sbDataStore = null;
    let _sbAuth = null;

    async function getSupabase() {
        if (_supabase) return { supabase: _supabase, dataStore: _sbDataStore, auth: _sbAuth };
        const clientPkg = await supabasePkg.init();
        _supabase = clientPkg.supabase;
        _sbDataStore = clientPkg.dataStore;
        _sbAuth = clientPkg.auth;
        return { supabase: _supabase, dataStore: _sbDataStore, auth: _sbAuth };
    }

    // ============================================================
    // 1. DATA STORE PATCHES
    // ============================================================
    function patchDataStore() {
        const DS = DataStore.prototype;

        const getTenantId = async () => {
            const { auth } = await getSupabase();
            return global.store?.cloud?.tenantId || auth.currentTenant?.id;
        };

        // 1.1 CONNECT CLOUD
        DS.connectCloud = async function (user, tenant) {
            this.cloud.userId = user?.uid || user?.id;
            const incomingTenantId = tenant?.id || tenant?.tenantId || 'default';
            const storedTenantId = localStorage.getItem('rw_tenant_id');
            this.cloud.tenantId = storedTenantId || incomingTenantId;
            this.cloud.isOffline = false;
            this.cloud.isHydrating = true;
            try {
                const { dataStore } = await getSupabase();
                dataStore.setTenant(this.cloud.tenantId, this.cloud.userId);
                // Reset in-memory state to prevent cross-tenant contamination
                this.data = this.createEmptyData();
                this.clearUnsegmentedLocalStorage();
                const loaded = this.loadFromLocalStorage();
                if (loaded) {
                    this.ensureTaxesExist();
                    this.cloud.isOffline = false;
                }
                if (navigator.onLine) {
                    await dataStore.syncAllTables(this.cloud.tenantId);
                    this._mergeRemoteData(dataStore);
                    this.cloud.hasLoadedCloudData = true;
                }
                this.ensureDefaultLocal();
                this.ensureLocalScopedData();
                this._startSupabaseRealtime(dataStore);
                this.cloud.isHydrating = false;
                this.notifyAll();
                this.updateSyncIndicator();
            } catch (err) {
                console.error('[Adapter] connectCloud error:', err);
                this.cloud.isHydrating = false;
                this.cloud.isOffline = true;
            }
        };

        DS._mergeRemoteData = function (sbDS) {
            const tables = ['products','categories','clients','locales','sales','purchases','suppliers','warehouses','warehouseStock','taxes','posTerminals','loyaltyCards','walletTransactions','crmCoupons','discountCampaigns','accountingAccounts','accountingEntries','transfers','pendingTickets'];
            const changedTables = [];
            tables.forEach(tbl => {
                const remote = sbDS.getAll(tbl);
                if (remote && remote.length) {
                    const local = this.data[tbl] || [];
                    const merged = [...local];
                    remote.forEach(rItem => {
                        let idx = merged.findIndex(l => l.id === rItem.id);
                        // warehouseStock: match by logical tuple to avoid duplicates when ids differ
                        if (idx === -1 && tbl === 'warehouseStock') {
                            idx = merged.findIndex(l =>
                                l.productId === rItem.productId &&
                                l.warehouseId === rItem.warehouseId &&
                                (l.lotNumber || null) === (rItem.lotNumber || null) &&
                                (l.expiryDate || null) === (rItem.expiryDate || null) &&
                                (l.variantKey || null) === (rItem.variantKey || null)
                            );
                        }
                        if (idx >= 0) {
                            const rTime = new Date(rItem.updatedAt || rItem.createdAt || 0).getTime();
                            const lTime = new Date(merged[idx].updatedAt || merged[idx].createdAt || 0).getTime();
                            if (rTime >= lTime) {
                                const before = JSON.stringify(merged[idx]);
                                merged[idx] = { ...merged[idx], ...rItem };
                                if (JSON.stringify(merged[idx]) !== before) changedTables.push(tbl);
                            }
                        } else {
                            merged.push(rItem);
                            changedTables.push(tbl);
                        }
                    });
                    if (merged.length !== local.length) changedTables.push(tbl);
                    this.data[tbl] = merged;
                    this.save(tbl);
                }
            });
            if (changedTables.length) {
                this.notifyAll();
                [...new Set(changedTables)].forEach(tbl => this.notify(tbl));
            }
        };

        DS._startSupabaseRealtime = function (sbDS) {
            const tenantId = this.cloud.tenantId;
            if (!tenantId) return;
            sbDS.subscribeRealtime('products', tenantId, (payload) => this._applyRealtimeChange('products', payload));
            sbDS.subscribeRealtime('sales', tenantId, (payload) => this._applyRealtimeChange('sales', payload));
            sbDS.subscribeRealtime('clients', tenantId, (payload) => this._applyRealtimeChange('clients', payload));
            sbDS.subscribeRealtime('warehouseStock', tenantId, (payload) => this._applyRealtimeChange('warehouseStock', payload));
        };

        DS._applyRealtimeChange = function (table, payload) {
            const { eventType, new: newRec } = payload;
            const data = this.data[table] || [];
            if (eventType === 'INSERT') {
                if (!data.find(d => d.id === newRec.id)) { data.push(newRec); this.save(table); this.notify(table); }
            } else if (eventType === 'UPDATE') {
                const idx = data.findIndex(d => d.id === newRec.id);
                if (idx >= 0) { data[idx] = { ...data[idx], ...newRec }; this.save(table); this.notify(table); }
            } else if (eventType === 'DELETE') {
                this.data[table] = data.filter(d => d.id !== newRec.id); this.save(table); this.notify(table);
            }
        };

        // 1.2 SAVE CLOUD NOW
        DS.saveCloudNow = async function () {
            if (this._isSavingCloud) return;
            this._isSavingCloud = true;
            try {
                if (!this.cloud.enabled || !this.cloud.userId || !this.cloud.tenantId) return;
                if (global.AppState?.practicalExam) return;
                await this.processOfflineOperations();
                const { dataStore } = await getSupabase();
                await dataStore.processSyncQueue();
                this.updateSyncIndicator();
            } finally { this._isSavingCloud = false; }
        };

        // 1.3 SAVE TO SUBCOLLECTIONS
        DS.saveToSubcollections = async function () {
            console.log('[Adapter] saveToSubcollections → delegated to incremental Supabase sync');
        };

        // 1.4 COMMIT SALE STOCK
        DS.commitSaleStockOperation = async function (operation) {
            if (!operation?.items?.length) return true;
            const tenantId = this.cloud.tenantId;
            const makeOp = () => this.createSaleSyncOperation ? this.createSaleSyncOperation(operation, {}) : { type: 'sale-stock-sync', items: operation.items, id: operation.syncOperationId, createdAt: Date.now(), status: 'pending', retries: 0 };
            if (!tenantId || !navigator.onLine) return this.queueOfflineOperation(makeOp());
            try {
                const { supabase: sb } = await getSupabase();
                for (const item of operation.items) {
                    const qty = Math.max(0, Number(item.qty || item.quantity || 0));
                    if (qty === 0) continue;
                    const { error } = await sb.rpc('decrement_stock', {
                        p_product_id: item.id,
                        p_quantity: qty,
                        p_tenant_id: tenantId,
                    });
                    if (error) throw error;
                }
                for (const item of operation.items) {
                    const qty = Math.max(0, Number(item.qty || item.quantity || 0));
                    if (qty === 0) continue;
                    const product = this.getById('products', item.id);
                    if (product) {
                        this.update('products', item.id, { stock: Math.max((product.stock || 0) - qty, 0) }, false);
                    }
                }
                return true;
            } catch (err) {
                console.error('[Adapter] Stock commit failed:', err);
                return this.queueOfflineOperation(makeOp());
            }
        };

        // 1.5 PROCESS OFFLINE OPS
        DS.processOfflineOperations = async function () {
            let queue = this.loadOfflineQueue();
            if (!queue.length) { this.updateSyncIndicator(); return; }
            const { dataStore } = await getSupabase();
            for (const op of queue) {
                if (op.status === 'failed') continue;
                try {
                    if (op.type === 'sale-stock-sync') {
                        await this.commitSaleStockOperation(op.data || op);
                    } else {
                        dataStore.enqueue(op.table || 'sales', op.operation || 'insert', op.data || op);
                    }
                    op.status = 'completed';
                } catch (err) {
                    console.warn('[Adapter] Offline op failed:', op.id, err.message);
                    op.retries = (op.retries || 0) + 1;
                    if (op.retries >= 5) op.status = 'failed';
                    else op.status = 'retrying';
                }
            }
            queue = queue.filter(o => o.status !== 'completed' && o.status !== 'failed');
            this.saveOfflineQueue(queue);
            this.updateSyncIndicator();
            await dataStore.processSyncQueue();
        };

        // 1.6 SYNC ACCOUNTING TO SUPABASE
        DS.syncAccountingToSupabase = async function () {
            const tenantId = this.cloud.tenantId;
            if (!tenantId || !navigator.onLine) return;
            try {
                const { supabase: sb } = await getSupabase();

                // Sync accounting accounts
                const accounts = this.data.accountingAccounts || [];
                for (const acc of accounts) {
                    if (acc._supabaseSynced) continue;
                    const uuid = crypto.randomUUID ? crypto.randomUUID() : `acc-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
                    const { error } = await sb.from('accounting_accounts').upsert({
                        id: acc.id && acc.id.includes('-') ? acc.id : uuid,
                        tenant_id: tenantId,
                        code: acc.code || '',
                        name: acc.name || '',
                        type: acc.type || '',
                        nature: acc.nature || '',
                        class_id: String(acc.class || ''),
                        description: acc.description || '',
                        balance: acc.balance || 0,
                        is_active: acc.active !== false,
                    }, { onConflict: 'id', ignoreDuplicates: false });
                    if (!error) {
                        this.update('accountingAccounts', acc.id, { _supabaseSynced: true }, true);
                    }
                }

                // Sync unsynced accounting entries
                const entries = this.data.accountingEntries || [];
                for (const entry of entries) {
                    if (entry._supabaseSynced) continue;
                    const uuid = crypto.randomUUID ? crypto.randomUUID() : `acct-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
                    const { error } = await sb.from('accounting_entries').upsert({
                        id: entry.id && entry.id.includes('-') ? entry.id : uuid,
                        tenant_id: tenantId,
                        number: parseInt(String(entry.number).replace(/[^0-9]/g, '').slice(0, 10)) || 0,
                        date: entry.date,
                        document_date: entry.documentDate || entry.date,
                        concept: entry.concept || '',
                        document_ref: entry.documentRef || '',
                        sale_id: entry.saleId || null,
                        lines: entry.lines || [],
                        total_debe: entry.totalDebe || 0,
                        total_haber: entry.totalHaber || 0,
                        status: entry.status || 'posted',
                        source: entry.source || 'manual',
                    }, { onConflict: 'id', ignoreDuplicates: false });
                    if (!error) {
                        this.update('accountingEntries', entry.id, { _supabaseSynced: true }, true);
                    }
                }
            } catch (err) {
                console.warn('[Adapter] Accounting sync failed:', err);
            }
        };

        // 1.7 START CATALOG LISTENER
        DS.startCatalogListener = async function () {
            if (this.cloud.catalogUnsub) { try { this.cloud.catalogUnsub(); } catch (e) {} this.cloud.catalogUnsub = null; }
            const tenantId = this.cloud.tenantId;
            if (!tenantId) return;
            const { dataStore } = await getSupabase();
            const channel = dataStore.subscribeRealtime('products', tenantId, (payload) => this._applyRealtimeChange('products', payload));
            this.cloud.catalogUnsub = () => channel?.unsubscribe?.();
        };

        // 1.7 DISCONNECT CLOUD
        const origDisconnectCloud = DS.disconnectCloud;
        DS.disconnectCloud = async function () {
            const { dataStore } = await getSupabase();
            dataStore.unsubscribeAll();
            this.cloud.catalogUnsub = null;
            this.cloud.hasLoadedCloudData = false;
            if (origDisconnectCloud) origDisconnectCloud.call(this);
        };

        // 1.8 SCHEDULE CLOUD SAVE
        DS.scheduleCloudSave = function () {
            if (!this.cloud.enabled || !this.cloud.userId || this.cloud.isHydrating) return;
            if (global.AppState?.practicalExam) return;
            if (this.cloud.saveTimer) clearTimeout(this.cloud.saveTimer);
            this.cloud.saveTimer = setTimeout(() => this.saveCloudNow(), 2000);
        };

        // 1.9 SYNC TENANT CATALOG/CLIENTS
        DS.syncTenantCatalog = async function () {
            if (!this.cloud.userId || !this.cloud.tenantId || this.cloud.tenantId === 'default') return;
            const { dataStore } = await getSupabase();
            await dataStore.syncTable('products', this.cloud.tenantId);
            this._mergeRemoteData(dataStore);
        };
        DS.syncTenantClients = async function () {
            if (!this.cloud.userId || !this.cloud.tenantId || this.cloud.tenantId === 'default') return;
            const { dataStore } = await getSupabase();
            await dataStore.syncTable('clients', this.cloud.tenantId);
            this._mergeRemoteData(dataStore);
        };

        // 1.10 LOAD FROM SUBCOLLECTIONS
        DS.loadFromSubcollections = async function () {
            if (!this.cloud.tenantId) return null;
            const { dataStore } = await getSupabase();
            await dataStore.syncAllTables(this.cloud.tenantId);
            this._mergeRemoteData(dataStore);
            return this.data;
        };

        // ============================================================
        // HELPER: Column whitelists per table for direct Supabase sync
        // ============================================================
        const TABLE_COLUMNS = {
            products: new Set(['id','tenant_id','name','sku','price','cost','stock','min_stock','category','category_id','image','image_url','tax_id','tax_rate','is_active','has_variants','has_expiry','lot_number','expiry_date','variants','sizes','colors','unit','barcode','description','supplier_ids','cost_source','cost_calculation','sale_account_code','purchase_account_code','units_per_box','box_price','half_box_price','metadata','local_id','created_at','updated_at']),
            purchases: new Set(['id','tenant_id','supplier_id','locale_id','invoice_number','items','subtotal','tax_total','total','status','notes','local_id','created_at','updated_at']),
            clients: new Set(['id','tenant_id','first_name','last_name','email','phone','address','city','tax_id','notes','credit_limit','wallet_balance','loyalty_points','pin_hash','is_active','tier','loyalty_card_number','metadata','local_id','created_at','updated_at']),
            categories: new Set(['id','tenant_id','name','color','icon','sort_order','created_at','updated_at']),
            suppliers: new Set(['id','tenant_id','name','contact_name','email','phone','address','tax_id','payment_terms','is_active','created_at','updated_at']),
            locales: new Set(['id','tenant_id','name','code','address','phone','is_main','is_active','created_at','updated_at']),
            warehouses: new Set(['id','tenant_id','name','code','type','locale_id','address','is_active','created_at','updated_at']),
            warehouseStock: new Set(['id','tenant_id','warehouse_id','product_id','quantity','lot_number','expiry_date','variant_key','created_at','updated_at']),
            inventoryMovements: new Set(['id','tenant_id','warehouse_id','product_id','type','quantity','lot_number','expiry_date','variant_key','reference_id','reference_type','running_balance','reason','notes','user_id','user_name','created_at','updated_at']),
            transfers: new Set(['id','tenant_id','from_warehouse_id','to_warehouse_id','items','status','notes','created_by','created_at','updated_at']),
            posTerminals: new Set(['id','tenant_id','name','code','locale_id','is_active','current_session','created_at','updated_at']),
            posTerminalClosures: new Set(['id','tenant_id','terminal_id','user_id','opened_at','closed_at','opening_amount','closing_amount','expected_amount','difference','sales_count','sales_total','payment_totals','notes','created_at']),
            taxes: new Set(['id','tenant_id','name','rate','type','is_default','is_active','created_at','updated_at']),
            loyaltyCards: new Set(['id','tenant_id','client_id','card_number','tier','points','total_spent','issue_date','expiry_date','is_active','metadata','created_at','updated_at']),
            walletTransactions: new Set(['id','tenant_id','client_id','type','amount','balance_after','points','description','reference_id','reference_type','user_id','metadata','created_at']),
            crmCoupons: new Set(['id','tenant_id','code','name','description','discount_type','discount_value','min_purchase','max_uses','uses_count','max_uses_per_client','valid_from','valid_until','applicable_products','applicable_categories','is_active','created_by','created_at','updated_at']),
            crmCouponPurchases: new Set(['id','tenant_id','coupon_id','client_id','sale_id','discount_applied','metadata','created_at']),
            reloadRequests: new Set(['id','tenant_id','client_id','amount','payment_method','payment_reference','status','processed_by','processed_at','notes','metadata','created_at','updated_at']),
            discountCampaigns: new Set(['id','tenant_id','name','description','campaign_type','discount_value','min_purchase','valid_from','valid_until','applicable_client_tiers','applicable_products','applicable_categories','is_active','priority','created_by','created_at','updated_at']),
            crmActivities: new Set(['id','tenant_id','client_id','activity_type','description','amount','points','reference_id','reference_type','user_id','metadata','created_at']),
            accountingAccounts: new Set(['id','tenant_id','code','name','type','nature','class_id','description','is_active','balance','created_at','updated_at']),
            accountingEntries: new Set(['id','tenant_id','number','date','document_date','concept','document_ref','sale_id','lines','total_debe','total_haber','status','source','created_at','updated_at']),
        };

        const SB_TABLE_MAP = {
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

        function getSbTable(localName) {
            return SB_TABLE_MAP[localName] || localName;
        }

        function genUUID() {
            return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        }

        function isUUID(str) {
            return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
        }

        function cleanPayload(collection, payload, tenantId) {
            var columns = TABLE_COLUMNS[collection];
            if (!columns) return null;
            var cleaned = { tenant_id: tenantId };
            for (var key in payload) {
                if (!payload.hasOwnProperty(key)) continue;
                var val = payload[key];
                if (key === 'id') {
                    if (isUUID(val)) {
                        cleaned.id = val;
                    } else {
                        cleaned.local_id = val;
                    }
                    continue;
                }
                var snakeKey = key.replace(/[A-Z]/g, function (l) { return '_' + l.toLowerCase(); });
                if (columns.has(snakeKey)) {
                    if (val !== undefined && val !== null) {
                        cleaned[snakeKey] = val;
                    }
                }
            }
            if (!cleaned.id) cleaned.id = genUUID();
            if (typeof cleaned.created_at === 'number') cleaned.created_at = new Date(cleaned.created_at).toISOString();
            if (typeof cleaned.updated_at === 'number') cleaned.updated_at = new Date(cleaned.updated_at).toISOString();
            return cleaned;
        }

        function normalizeProductForSupabase(store, product) {
            if (!product || typeof product !== 'object') return product;
            const normalized = { ...product };
            // Map category name to category_id if possible
            if (normalized.category && !normalized.categoryId) {
                const cat = (store.data.categories || []).find(c => c.name === normalized.category);
                if (cat) normalized.categoryId = cat.id;
            }
            // Map taxId to tax_id and tax_rate
            if (normalized.taxId) {
                normalized.tax_id = normalized.taxId;
                const tax = (store.data.taxes || []).find(t => t.id === normalized.taxId);
                if (tax) normalized.tax_rate = tax.rate;
            }
            return normalized;
        }

        // 1.11 HOOK ADD/UPDATE/DELETE (direct Supabase sync)
        const origAdd = DS.add;
        DS.add = function (collection, item, skipCloudSave) {
            if (item && !isUUID(item.id)) {
                var localId = item.id;
                item.id = genUUID();
                if (localId) item._localId = localId;
            }
            const result = origAdd.call(this, collection, item, skipCloudSave);
            if (!skipCloudSave && !global.AppState?.practicalExam) {
                const tenantId = this.cloud?.tenantId;
                if (tenantId && tenantId !== 'default' && navigator.onLine) {
                    const syncItem = collection === 'products' ? normalizeProductForSupabase(this, result) : result;
                    const cleaned = cleanPayload(collection, syncItem, tenantId);
                    if (cleaned) {
                        const sbTable = getSbTable(collection);
                        getSupabase().then(function (pkg) {
                            pkg.supabase.from(sbTable).insert(cleaned).then(function (res) {
                                if (res.error) console.warn('[Adapter] Direct insert failed for', collection + ':', res.error.message);
                            }).catch(function (err) {
                                console.warn('[Adapter] Direct insert error for', collection + ':', err.message);
                            });
                        }).catch(function (err) {
                            console.warn('[Adapter] getSupabase error in add:', err.message);
                        });
                    }
                } else {
                    getSupabase().then(function (pkg) { pkg.dataStore.insert(collection, result, true); }).catch(function () {});
                    this.scheduleCloudSave();
                }
            }
            return result;
        };
        const origUpdate = DS.update;
        DS.update = function (collection, id, changes, skipCloudSave) {
            const result = origUpdate.call(this, collection, id, changes, skipCloudSave);
            if (!skipCloudSave && result && !global.AppState?.practicalExam) {
                const tenantId = this.cloud?.tenantId;
                if (tenantId && tenantId !== 'default' && navigator.onLine && isUUID(id)) {
                    const syncChanges = collection === 'products' ? normalizeProductForSupabase(this, changes) : changes;
                    var cleaned = cleanPayload(collection, syncChanges, tenantId);
                    if (cleaned) {
                        delete cleaned.id;
                        delete cleaned.tenant_id;
                        const sbTable = getSbTable(collection);
                        getSupabase().then(function (pkg) {
                            pkg.supabase.from(sbTable).update(cleaned).eq('id', id).eq('tenant_id', tenantId).then(function (res) {
                                if (res.error) console.warn('[Adapter] Direct update failed for', collection + ':', res.error.message);
                            }).catch(function (err) {
                                console.warn('[Adapter] Direct update error for', collection + ':', err.message);
                            });
                        }).catch(function (err) {
                            console.warn('[Adapter] getSupabase error in update:', err.message);
                        });
                    }
                } else {
                    getSupabase().then(function (pkg) { pkg.dataStore.update(collection, id, changes, true); }).catch(function () {});
                    this.scheduleCloudSave();
                }
            }
            return result;
        };
        const origDelete = DS.delete;
        DS.delete = function (collection, id, skipCloudSave) {
            const result = origDelete.call(this, collection, id, skipCloudSave);
            if (!skipCloudSave && !global.AppState?.practicalExam) {
                const tenantId = this.cloud?.tenantId;
                if (tenantId && tenantId !== 'default' && navigator.onLine && isUUID(id)) {
                    const sbTable = getSbTable(collection);
                    getSupabase().then(function (pkg) {
                        pkg.supabase.from(sbTable).delete().eq('id', id).eq('tenant_id', tenantId).then(function (res) {
                            if (res.error) console.warn('[Adapter] Direct delete failed for', collection + ':', res.error.message);
                        }).catch(function (err) {
                            console.warn('[Adapter] Direct delete error for', collection + ':', err.message);
                        });
                    }).catch(function (err) {
                        console.warn('[Adapter] getSupabase error in delete:', err.message);
                    });
                } else {
                    getSupabase().then(function (pkg) { pkg.dataStore.delete(collection, id, true); }).catch(function () {});
                    this.scheduleCloudSave();
                }
            }
            return result;
        };

        // 1.12 SYNC INDIVIDUAL ITEMS (warehouseStock, inventoryMovements, etc.)
        DS._scheduleCloudSync = async function (collection, item) {
            if (!item?.id) return;
            const tenantId = this.cloud?.tenantId;
            if (!tenantId || tenantId === 'default') return;
            if (global.AppState?.practicalExam) return;

            // Migrate id synchronously to avoid races between concurrent calls
            let syncItem = item;
            const arr = this.data[collection];
            let localIndex = Array.isArray(arr) ? arr.findIndex(i => i.id === item.id) : -1;
            if (!isUUID(item.id)) {
                const newId = genUUID();
                if (localIndex >= 0) {
                    arr[localIndex].id = newId;
                    this.save(collection);
                    syncItem = arr[localIndex];
                } else {
                    syncItem = { ...item, id: newId };
                }
            }

            try {
                const { dataStore } = await getSupabase();
                if (!dataStore) return;
                if (dataStore.currentTenantId !== tenantId) {
                    dataStore.setTenant(tenantId, this.cloud.userId);
                }

                // For warehouseStock, avoid Supabase duplicates by matching the logical tuple
                if (collection === 'warehouseStock') {
                    const remote = dataStore.getAll('warehouseStock');
                    const match = (remote || []).find(r =>
                        r.productId === syncItem.productId &&
                        r.warehouseId === syncItem.warehouseId &&
                        (r.lotNumber || null) === (syncItem.lotNumber || null) &&
                        (r.expiryDate || null) === (syncItem.expiryDate || null) &&
                        (r.variantKey || null) === (syncItem.variantKey || null)
                    );
                    if (match && match.id !== syncItem.id) {
                        localIndex = Array.isArray(arr) ? arr.findIndex(i => i.id === syncItem.id) : -1;
                        if (localIndex >= 0) {
                            arr[localIndex].id = match.id;
                            this.save(collection);
                            syncItem = arr[localIndex];
                        } else {
                            syncItem = { ...syncItem, id: match.id };
                        }
                    }
                }

                // Do not sync branch localId to Supabase; keep it local-only
                const { localId, ...payload } = syncItem;
                // Ensure timestamps are ISO strings for Supabase
                if (payload.createdAt && typeof payload.createdAt === 'number') payload.createdAt = new Date(payload.createdAt).toISOString();
                if (payload.updatedAt && typeof payload.updatedAt === 'number') payload.updatedAt = new Date(payload.updatedAt).toISOString();
                if (payload.timestamp && typeof payload.timestamp === 'number') payload.timestamp = new Date(payload.timestamp).toISOString();
                // Always update local cache and enqueue, so offline changes sync when back online
                const existing = dataStore.getById(collection, payload.id);
                dataStore.upsert(collection, payload, false);
                dataStore.enqueue(collection, existing ? 'update' : 'insert', payload);
            } catch (err) {
                console.warn('[Adapter] _scheduleCloudSync failed for', collection + ':', err.message);
            }
        };
    }

    // ============================================================
    // 2. UI CONTROLLER PATCHES
    // ============================================================
    function patchUIController() {
        const UI = UIController.prototype;

        // 2.1 SAVE SALE RECORD
        const origSaveSaleRecord = UI.saveSaleRecord;
        UI.saveSaleRecord = async function (sale, options = {}) {
            const result = await origSaveSaleRecord.call(this, sale, options);
            try {
                const tenantId = global.store?.cloud?.tenantId;
                if (!tenantId || !navigator.onLine) return result;
                const { supabase: sb } = await getSupabase();

                // The sale row itself is already synced by the DS.add hook; only handle side-effects here.
                if (sale.paymentMethod === 'wallet' && sale.clientId) {
                    await sb.from('wallet_transactions').insert({
                        tenant_id: tenantId,
                        client_id: sale.clientId,
                        type: 'debit',
                        amount: sale.total,
                        description: `Compra ticket ${sale.ticket}`,
                        reference_id: sale.id,
                        reference_type: 'sale',
                    });
                }
                const points = Math.floor((sale.total || 0) / 1000);
                if (points > 0 && sale.clientId) {
                    await sb.rpc('add_loyalty_points', { p_client_id: sale.clientId, p_points: points, p_tenant_id: tenantId });
                }

                // Sync auto-created accounting entries for this sale
                try {
                    const localEntries = global.store.get('accountingEntries') || [];
                    const saleEntries = localEntries.filter(e => e.saleId === sale.id && !e._supabaseSynced);
                    for (const entry of saleEntries) {
                        const uuid = crypto.randomUUID ? crypto.randomUUID() : `acct-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
                        const { error: entryErr } = await sb.from('accounting_entries').insert({
                            id: uuid,
                            tenant_id: tenantId,
                            number: parseInt(String(entry.number).replace(/[^0-9]/g, '').slice(0, 10)) || 0,
                            date: entry.date,
                            document_date: entry.documentDate || entry.date,
                            concept: entry.concept || '',
                            document_ref: entry.documentRef || '',
                            sale_id: entry.saleId || null,
                            lines: entry.lines || [],
                            total_debe: entry.totalDebe || 0,
                            total_haber: entry.totalHaber || 0,
                            status: entry.status || 'posted',
                            source: entry.source || 'auto',
                        });
                        if (!entryErr) {
                            global.store.update('accountingEntries', entry.id, { _supabaseSynced: true });
                        }
                    }
                } catch (acctErr) { console.warn('[Adapter] Accounting entry sync failed:', acctErr); }
            } catch (err) { console.warn('[Adapter] Post-sale sync failed:', err); }
            return result;
        };

        // 2.2 SAVE CLIENT
        const origSaveClient = UI.saveClient;
        UI.saveClient = async function (clientId) {
            origSaveClient.call(this, clientId);
            try {
                const tenantId = global.store?.cloud?.tenantId;
                if (!tenantId || !navigator.onLine) return;
                const client = clientId ? global.store.getById('clients', clientId) : global.store.get('clients').slice(-1)[0];
                if (!client) return;
                const { supabase: sb } = await getSupabase();
                const payload = {
                    tenant_id: tenantId,
                    first_name: client.firstName || '',
                    last_name: client.lastName || '',
                    email: client.email || '',
                    phone: client.phone || '',
                    address: client.address || '',
                    tax_id: client.taxId || '',
                    credit_limit: client.credit || 0,
                    loyalty_card_number: client.loyaltyCardNumber || null,
                    tier: client.tier || 'bronze',
                    wallet_balance: client.walletBalance || 0,
                    loyalty_points: client.loyaltyPoints || 0,
                    pin_hash: client.pinHash || '',
                    is_active: true,
                };
                // ISO 27001 A.10.1.1: Generate UUID for new clients to match schema
                const clientUuid = client.id && client.id.includes('-') ? client.id
                    : (crypto.randomUUID ? crypto.randomUUID() : `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); }));
                if (clientUuid !== client.id) {
                    // Local ID format — assign UUID and update local store
                    global.store.update('clients', client.id, { id: clientUuid, _localId: client.id }, true);
                }
                if (clientId) await sb.from('clients').update(payload).eq('id', clientId).eq('tenant_id', tenantId);
                else await sb.from('clients').insert({ ...payload, id: clientUuid });
            } catch (err) { console.warn('[Adapter] Client sync failed:', err); }
        };

        // 2.3 CREDIT PAYMENT
        const origRegisterCreditPayment = UI.registerCreditPayment;
        UI.registerCreditPayment = async function (clientId, saleId) {
            const result = await origRegisterCreditPayment.call(this, clientId, saleId);
            try {
                const tenantId = global.store?.cloud?.tenantId;
                if (!tenantId || !navigator.onLine) return result;
                const amount = parseFloat(document.getElementById(`payment-${saleId}`)?.value) || 0;
                if (amount > 0) {
                    const { supabase: sb } = await getSupabase();
                    await sb.rpc('register_credit_payment', { p_sale_id: saleId, p_amount: amount, p_tenant_id: tenantId });
                }
            } catch (err) { console.warn('[Adapter] Credit payment sync failed:', err); }
            return result;
        };

        // 2.4 SAVE USER
        const origSaveUser = UI.saveUser;
        UI.saveUser = async function (userId) {
            const modal = document.getElementById('activeModal');
            if (!modal) return;
            const nameEl = modal.querySelector('#userFormName');
            const emailEl = modal.querySelector('#userFormEmail');
            const roleEl = modal.querySelector('#userFormRole');
            if (!nameEl || !emailEl || !roleEl) return;
            const existingUser = userId ? global.store.getById('users', userId) : null;
            const name = String(nameEl.value ?? '').trim();
            const email = String(emailEl.value ?? '').trim().toLowerCase();
            const role = String(roleEl.value ?? 'cashier').trim() || 'cashier';
            const passwordEl = modal.querySelector('#userFormPassword');
            const password = userId ? '' : String(passwordEl?.value ?? '').trim();
            if (!name || !email) { if (typeof this.showToast === 'function') this.showToast('Complete los campos obligatorios', 'error'); return; }
            if (!userId && (!password || password.length < 6)) { if (typeof this.showToast === 'function') this.showToast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
            const tenantId = global.AppState?.tenant?.id;
            if (!tenantId || tenantId === 'default') { if (typeof this.showToast === 'function') this.showToast('No hay tenant válido', 'error'); return; }
            const allLocalesChecked = modal.querySelector('#userAllLocales')?.checked === true;
            const selectedLocalIds = Array.from(modal.querySelectorAll('input[name="userLocalIds"]:checked')).map(cb => cb.value);
            const localIds = role === 'admin' || allLocalesChecked ? [] : selectedLocalIds;
            const allLocals = role === 'admin' || allLocalesChecked;
            try {
                if (userId) {
                    const authUid = existingUser?.uid || existingUser?.id || existingUser?.authUid || userId;
                    const { supabase: sb } = await getSupabase();
                    const { error } = await sb.rpc('update_tenant_user', {
                        p_tenant_id: tenantId,
                        p_user_id: authUid,
                        p_role: role,
                        p_metadata: JSON.stringify({ localIds, allLocals })
                    });
                    if (error) throw error;
                    global.store.update('users', userId, { name, email, role, localIds, allLocals, active: true, uid: authUid });
                    if (typeof this.showToast === 'function') this.showToast('Usuario actualizado', 'success');
                } else {
                    const { supabase: sb } = await getSupabase();
                    const { data: newUid, error } = await sb.rpc('create_user_for_tenant', {
                        p_tenant_id: tenantId,
                        p_email: email,
                        p_password: password,
                        p_name: name,
                        p_role: role,
                        p_metadata: JSON.stringify({ localIds, allLocals })
                    });
                    if (error) throw error;
                    if (!newUid) throw new Error('No se pudo crear el usuario');
                    global.store.add('users', { id: newUid, uid: newUid, name, email, role, localIds, allLocals, active: true });
                    if (typeof this.showToast === 'function') this.showToast('Usuario creado y sincronizado', 'success');
                }
                if (typeof this.closeModal === 'function') this.closeModal();
                if (typeof this.navigateTo === 'function') this.navigateTo('users');
            } catch (error) { console.error('[Adapter] saveUser error:', error); if (typeof this.showToast === 'function') this.showToast(error?.message || 'Error guardando usuario', 'error'); }
        };

        // 2.5 DELETE USER
        const origDeleteUser = UI.deleteUser;
        UI.deleteUser = async function (id) {
            const user = global.store.getById('users', id);
            if (!user) return;
            if (!await (this.confirmAsync ? this.confirmAsync(`¿Eliminar usuario "${user.name}"?`) : confirm(`¿Eliminar usuario "${user.name}"?`))) return;
            try {
                const tenantId = global.AppState?.tenant?.id;
                const userUid = user.uid || user.id;
                if (tenantId && userUid && navigator.onLine) {
                    const { supabase: sb } = await getSupabase();
                    const { error } = await sb.rpc('delete_tenant_user', { p_tenant_id: tenantId, p_user_id: userUid });
                    if (error) console.warn('[Adapter] deleteTenantUser RPC failed:', error.message);
                }
                global.store.delete('users', id);
                if (typeof this.showToast === 'function') this.showToast('Usuario eliminado', 'success');
                if (typeof this.navigateTo === 'function') this.navigateTo('users');
            } catch (err) { console.error('[Adapter] deleteUser error:', err); if (typeof this.showToast === 'function') this.showToast('Error eliminando usuario', 'error'); }
        };

        // 2.6 WALLET PAYMENT — Supabase Realtime cross-device
        const origRequestWalletPayment = UI.requestWalletPayment;
        UI.requestWalletPayment = function(pricing, subtotal, discountAmount, promotionDiscount, manualDiscount, tax, total, paymentMethod, splitPayments, clientId, clientName) {
            // Call original (BroadcastChannel + localStorage + modal)
            origRequestWalletPayment.call(this, pricing, subtotal, discountAmount, promotionDiscount, manualDiscount, tax, total, paymentMethod, splitPayments, clientId, clientName);
            const pending = global.AppState.pendingWalletSale;
            if (!pending) return;
            const tenantId = global.store?.cloud?.tenantId;
            if (!tenantId || !navigator.onLine) return;
            getSupabase().then(async ({ supabase: sb }) => {
                try {
                    const items = pending.pricing?.lineItems?.map(i => ({
                        name: i.name,
                        qty: i.qty,
                        price: i.effectiveUnitPrice || i.baseUnitPrice || 0
                    })) || [];
                    await sb.from('payment_requests').upsert({
                        id: pending.saleId,
                        tenant_id: tenantId,
                        client_id: pending.clientId,
                        amount: pending.total,
                        items,
                        status: 'pending',
                        created_at: new Date().toISOString(),
                        expires_at: new Date(Date.now() + 5 * 60000).toISOString()
                    }, { onConflict: 'id' });
                    console.log('[Adapter] Payment request saved to Supabase:', pending.saleId);
                    // Subscribe to changes
                    const channel = sb.channel('wallet-payment-' + pending.saleId)
                        .on('postgres_changes', {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'payment_requests',
                            filter: `id=eq.${pending.saleId}`
                        }, (payload) => {
                            const newData = payload.new;
                            console.log('[Adapter] Realtime payment update:', newData);
                            if (newData.status === 'confirmed' && global.AppState.pendingWalletSale?.saleId === pending.saleId) {
                                if (typeof ui !== 'undefined' && ui.completeWalletSale) {
                                    ui.completeWalletSale(global.AppState.pendingWalletSale, newData.pin);
                                }
                            }
                            if (newData.status === 'rejected' && global.AppState.pendingWalletSale?.saleId === pending.saleId) {
                                if (typeof ui !== 'undefined' && ui.cancelWalletPayment) {
                                    ui.cancelWalletPayment(pending.saleId);
                                }
                            }
                        })
                        .subscribe();
                    global.AppState._walletPaymentUnsub = () => sb.removeChannel(channel);
                } catch (err) {
                    console.warn('[Adapter] Supabase wallet request failed:', err);
                }
            });
        };

        const origCompleteWalletSale = UI.completeWalletSale;
        UI.completeWalletSale = function(pending, pin) {
            if (global.AppState._walletPaymentUnsub) {
                global.AppState._walletPaymentUnsub();
                global.AppState._walletPaymentUnsub = null;
            }
            origCompleteWalletSale.call(this, pending, pin);
        };

        const origCancelWalletPayment = UI.cancelWalletPayment;
        UI.cancelWalletPayment = function(saleId) {
            if (global.AppState._walletPaymentUnsub) {
                global.AppState._walletPaymentUnsub();
                global.AppState._walletPaymentUnsub = null;
            }
            const tenantId = global.store?.cloud?.tenantId;
            if (tenantId && navigator.onLine) {
                getSupabase().then(async ({ supabase: sb }) => {
                    try {
                        await sb.from('payment_requests').update({ status: 'cancelled' }).eq('id', saleId).eq('tenant_id', tenantId);
                    } catch (e) {}
                });
            }
            origCancelWalletPayment.call(this, saleId);
        };
    }

    // ============================================================
    // 3. APP CONTROLLER PATCHES
    // ============================================================
    function patchAppController() {
        const AC = AppController;
        const origInitializeApp = AC.initializeApp;

        // 3.1 Patch tenant resolution
        AC.resolveTenantContext = async function (user) {
            const fallback = { id: 'default', profile: null, role: 'cashier', sharedStoreId: 'default', localIds: [], allLocals: false };
            if (!user?.id) return fallback;
            try {
                const { auth } = await getSupabase();
                const tenant = await auth.resolveTenant(user.id);
                if (tenant) return { id: tenant.id, profile: tenant, role: tenant.role || 'cashier', sharedStoreId: tenant.id, localIds: [], allLocals: true };
            } catch (err) { console.warn('[Adapter] resolveTenantContext Supabase failed:', err); }
            return fallback;
        };

        // 3.2 Replace AppController.init
        AC.init = async function () {
            AC.registerServiceWorker();
            const splashPromise = AC.animateSplash();
            // Safety timeout: only reload if truly stuck, not on auth errors
            AC.initTimeout = setTimeout(() => {
                if (!AC.initCompleted) {
                    console.warn('[AppController] Init timeout — stopping auto-reload to prevent loop');
                    AC.initCompleted = true;
                }
            }, 15000);
            AC.setupEventListeners();
            try {
                console.log('[Adapter] AppController.init starting...');
                const { supabase: sb, auth, dataStore } = await getSupabase();
                console.log('[Adapter] Supabase ready, checking session...');
                const { data: { session } } = await sb.auth.getSession();
                console.log('[Adapter] Session:', session ? 'found' : 'none');
                AC.initCompleted = true;
                if (AC.initTimeout) { clearTimeout(AC.initTimeout); AC.initTimeout = null; }
                await splashPromise;
                if (session?.user) {
                    auth.currentUser = session.user;
                    const tenant = await auth.resolveTenant(session.user.id);
                    console.log('[Adapter] Tenant resolved:', tenant ? tenant.id : 'null');
                    if (tenant) {
                        auth.currentTenant = tenant;
                        global.AppState.user = session.user;
                        global.AppState.tenant = tenant;
                        localStorage.setItem('rw_tenant_id', tenant.id || tenant.tenantId || 'default');
                        if (global.OfflineAuth && global.OfflineAuth.saveTenantSnapshot) {
                            global.OfflineAuth.saveTenantSnapshot(tenant);
                        }
                        await origInitializeApp.call(AC, session.user);
                    } else {
                        console.warn('[Adapter] No tenant for user, showing login');
                        AC.showLoginScreen();
                        setTimeout(() => {
                            if (typeof ui !== 'undefined' && ui.showToast) {
                                ui.showToast('Su usuario no está vinculado a ningún negocio. Contacte al administrador.', 'error', 6000);
                            }
                        }, 800);
                    }
                } else {
                    console.log('[Adapter] No session, showing login');
                    AC.showLoginScreen();
                }
            } catch (err) {
                console.error('[Adapter] AppController.init error:', err);
                AC.initCompleted = true;
                if (AC.initTimeout) { clearTimeout(AC.initTimeout); AC.initTimeout = null; }
                AC.showLoginScreen();
            }
        };

        AC.showLoginScreen = function () {
            const loginScreen = document.getElementById('loginScreen');
            const splash = document.getElementById('splashScreen');
            if (splash) splash.style.opacity = '0';
            setTimeout(() => {
                if (splash) splash.classList.add('hidden');
                if (loginScreen) { loginScreen.classList.remove('hidden'); setTimeout(() => loginScreen.style.opacity = '1', 50); }
            }, 500);
            AC.initCompleted = true;
            if (AC.initTimeout) { clearTimeout(AC.initTimeout); AC.initTimeout = null; }

            // Wire up Supabase login handlers
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.onsubmit = async (e) => {
                    e.preventDefault();
                    const email = String(document.getElementById('loginEmail')?.value || '').trim();
                    const password = String(document.getElementById('loginPassword')?.value || '').trim();
                    if (email && password) {
                        AC._handleSupabaseLogin(email, password);
                    } else {
                        if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Ingrese email y contraseña', 'error');
                    }
                };
            }
            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) {
                const newBtn = loginBtn.cloneNode(true);
                loginBtn.parentNode.replaceChild(newBtn, loginBtn);
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const email = String(document.getElementById('loginEmail')?.value || '').trim();
                    const password = String(document.getElementById('loginPassword')?.value || '').trim();
                    if (email && password) {
                        AC._handleSupabaseLogin(email, password);
                    } else {
                        if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Ingrese email y contraseña', 'error');
                    }
                });
            }
        };

        // 3.3 Logout
        const origCompleteLogout = AC.completeLogout;
        AC.completeLogout = async function () {
            store.disconnectCloud();
            AC.setLoginTarget('dashboard');
            try { const { supabase: sb } = await getSupabase(); await sb.auth.signOut(); } catch (e) {}
            if (global.OfflineAuth) { if (global.OfflineAuth.logout) global.OfflineAuth.logout(); else global.OfflineAuth.clearSession(); }
            global.AppState.offlineMode = false;
            global.AppState.demoMode = false;
            global.AppState.user = null;
            localStorage.removeItem('rw_tenant_id');
            location.reload();
        };

        // 3.4 Password reset
        AC.showPasswordReset = async function () {
            const email = document.getElementById('loginEmail')?.value;
            if (!email) { if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Ingrese su email', 'warning'); return; }
            try {
                const { supabase: sb } = await getSupabase();
                const { error } = await sb.auth.resetPasswordForEmail(email);
                if (error) throw error;
                if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Email de recuperación enviado', 'success');
            } catch (error) { if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Error: ' + error.message, 'error'); }
        };

        // 3.5 Google login
        AC.loginWithGoogle = async function () {
            try {
                const { supabase: sb } = await getSupabase();
                const { error } = await sb.auth.signInWithOAuth({ provider: 'google' });
                if (error) throw error;
            } catch (error) { if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Error: ' + error.message, 'error'); }
        };

        // 3.6 Login button handler (fallback for early DOMContentLoaded before showLoginScreen runs)
        document.addEventListener('DOMContentLoaded', () => {
            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) {
                const newBtn = loginBtn.cloneNode(true);
                loginBtn.parentNode.replaceChild(newBtn, loginBtn);
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const email = String(document.getElementById('loginEmail')?.value || '').trim();
                    const password = String(document.getElementById('loginPassword')?.value || '').trim();
                    if (email && password) {
                        AC._handleSupabaseLogin(email, password);
                    } else {
                        if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Ingrese email y contraseña', 'error');
                    }
                });
            }
        });

        AC._handleSupabaseLogin = async function (email, password) {
            const btn = document.getElementById('loginBtn');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...'; }
            try {
                const { auth } = await getSupabase();
                const { user, tenant, error } = await auth.signIn(email, password);
                if (error) throw error;
                if (user && tenant) {
                    global.AppState.user = user;
                    global.AppState.tenant = tenant;
                    if (global.OfflineAuth && global.OfflineAuth.saveTenantSnapshot) {
                        global.OfflineAuth.saveTenantSnapshot(tenant);
                    }
                    localStorage.setItem('rw_tenant_id', tenant.id || tenant.tenantId || 'default');
                    await origInitializeApp.call(AC, user);
                } else {
                    if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Credenciales incorrectas', 'error');
                }
            } catch (err) {
                console.error('[Adapter] Login error:', err);
                const msg = err.message || 'Error de autenticación';
                if (typeof ui !== 'undefined' && ui.showToast) ui.showToast(msg, 'error');
                else alert(msg);
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = 'Entrar'; }
            }
        };

        AC.submitPOSAccessLogin = async function () {
            const email = String(document.getElementById('posAccessEmail')?.value || '').trim();
            const password = String(document.getElementById('posAccessPassword')?.value || '').trim();
            const btn = document.getElementById('posAccessBtn');
            if (!email || !password) {
                if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Ingrese email y contraseña para entrar al POS', 'warning');
                return;
            }
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Entrando...'; }
            try {
                AppController.setLoginTarget('pos');
                await AC._handleSupabaseLogin(email, password);
                if (typeof ui !== 'undefined' && ui.closeModal) ui.closeModal();
            } catch (err) {
                console.error('[Adapter] POS login error:', err);
                const msg = err.message || 'Error de autenticación';
                if (typeof ui !== 'undefined' && ui.showToast) ui.showToast(msg, 'error');
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = 'Entrar al POS'; }
            }
        };

        AC._continueBootstrap = function (user, tenant) {
            // Deprecated: _handleSupabaseLogin now calls origInitializeApp directly
            // which runs the full bootstrap including renderNavigation, _prepareUI, etc.
        };
    }

    // ============================================================
    // BOOT
    // ============================================================
    // Patch synchronously so AppController.init is replaced BEFORE bootstrap calls it
    if (typeof DataStore !== 'undefined' && typeof UIController !== 'undefined' && typeof AppController !== 'undefined') {
        // We can't patch data store until supabase is ready, but we CAN patch AppController.init immediately
        // The inner implementation will lazily get supabase when called
        patchAppController();
        // UI patches also need supabase lazily
        patchUIController();
        // Data store patches need supabase lazily too
        patchDataStore();
        console.log('[Adapter] ✅ Patches applied synchronously');
    } else {
        console.error('[Adapter] Core dependencies missing');
    }

})(window);
