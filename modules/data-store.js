        class DataStore {
            constructor() {
                this.data = this.createEmptyData();
                this.listeners = {};
                this.cloud = {
                    enabled: true,
                    userId: null,
                    tenantId: 'default',
                    sharedStoreId: null, // Se establecerá al conectar con el tenant
                    isHydrating: false,
                    isOffline: false,
                    saveTimer: null,
                    hasLoadedCloudData: false,
                    catalogUnsub: null
                };
                this._isSavingCloud = false;
                this._sbDataStore = null;
                this._sbPkg = null;
                this.offlineSync = {
                    processing: false,
                    maxRetries: 5
                };
                this.initSampleData();
                this.ensureTaxesExist();
                this.ensureLocalScopedData();

                // Listen for localStorage changes from other tabs/frames (e.g. CRM iframe)
                window.addEventListener('storage', (e) => {
                    const prefix = `rw_${this.cloud.tenantId || 'default'}_`;
                    if (!e.key || !e.key.startsWith(prefix)) return;
                    const collection = e.key.slice(prefix.length);
                    const crmCollections = ['clients','loyaltyCards','walletTransactions','crmCoupons','crmCouponPurchases','reloadRequests','discountCampaigns','crmActivities'];
                    if (!crmCollections.includes(collection)) return;
                    try {
                        const arr = JSON.parse(e.newValue || '[]');
                        if (Array.isArray(arr)) {
                            console.log('[DataStore] External change detected for', collection, '- reloading');
                            this.data[collection] = arr;
                            this.notify(collection);
                        }
                    } catch (err) { /* ignore */ }
                });
            }

            ensureTaxesExist() {
                // Asegurar que siempre existan impuestos por defecto
                if (!this.data.taxes || this.data.taxes.length === 0) {
                    this.data.taxes = [
                        { id: 'tax_iva_15', name: 'IVA 15%', rate: 15, isDefault: true, active: true, description: 'Impuesto al Valor Agregado - Tasa General', createdAt: Date.now() },
                        { id: 'tax_iva_0', name: 'IVA 0% (Exento)', rate: 0, isDefault: false, active: true, description: 'Productos exentos de IVA', createdAt: Date.now() },
                        { id: 'tax_iva_5', name: 'IVA 5%', rate: 5, isDefault: false, active: true, description: 'IVA Reducido', createdAt: Date.now() }
                    ];
                    this.save('taxes');
                    this.persistAllLocal();
                    console.log('[Taxes] Impuestos inicializados');
                    // Si hay conexión a cloud, guardar también allí
                    if (this.cloud.userId && this.cloud.tenantId) {
                        this.scheduleCloudSave();
                    }
                }
            }

            createEmptyData(settingsOverride = {}) {
                return {
                    products: [],
                    categories: [
                        { id: 'cat1', name: 'Bebidas', color: 'blue', icon: 'fa-wine-bottle' },
                        { id: 'cat2', name: 'Alimentos', color: 'emerald', icon: 'fa-hamburger' },
                        { id: 'cat3', name: 'Snacks', color: 'amber', icon: 'fa-cookie' },
                        { id: 'cat4', name: 'Licores', color: 'purple', icon: 'fa-glass-martini' }
                    ],
                    clients: [],
                    sales: [],
                    quotes: [],
                    trainingResults: [],
                    suppliers: [],
                    users: [],
                    promotions: [],
                    purchases: [],
                    deliveries: [],
                    deliveryEvents: [],
                    publicOrders: [],
                    publicStoreSettings: null,
                    cashRegister: { isOpen: false, openingAmount: 0, currentAmount: 0, movements: [] },
                    cashRegisters: {},
                    posTerminals: [],
                    posTerminalClosures: [],
                    audit: [],
                    locales: [],
                    warehouses: [],
                    warehouseStock: [],
                    inventoryMovements: [],
                    containerReceipts: [],
                    transfers: [],
                    replenishmentAlerts: [],
                    expiryPromotions: [],
                    demandForecasts: [],
                    pendingTickets: [],
                    taxes: [],
                    taxTypes: [],
                    accountingAccounts: [],
                    accountingEntries: [],
                    loyaltyCards: [],
                    walletTransactions: [],
                    crmCoupons: [],
                    crmCouponPurchases: [],
                    reloadRequests: [],
                    discountCampaigns: [],
                    crmActivities: [],
                    accountingConfigs: {
                        fiscalYearStart: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
                        fiscalYearEnd: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
                        defaultCurrency: 'XAF',
                        invoiceAutoEntries: true,
                        nextEntryNumber: 1
                    },
                    settings: {
                        businessName: '',
                        taxId: '',
                        phone: '',
                        address: '',
                        taxRate: 0,
                        currency: 'XAF',
                        receiptLogo: true,
                        receiptQR: false,
                        billing: {
                            legalName: '',
                            nif: '',
                            address: '',
                            city: ''
                        },
                        ...settingsOverride
                    }
                };
            }

            normalizeSharedStoreId(value) {
                const raw = String(value || '').trim();
                // Usar el tenantId actual como valor por defecto para aislar datos por tenant
                const tenantId = this.cloud?.tenantId || 'default';
                if (!raw) return tenantId;
                if (/^__.*__$/.test(raw)) return tenantId;
                const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
                return sanitized || tenantId;
            }

            getTenantSharedStoreId() {
                return this.normalizeSharedStoreId(this.cloud.sharedStoreId);
            }

            getCloudDataScopeId() {
                return this.getTenantSharedStoreId();
            }

            getCloudRef(scopeId = this.getCloudDataScopeId()) {
                if (!this.cloud.tenantId || !scopeId) return null;
                return doc(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId);
            }

            getOfflineQueueKey() {
                return `rw_offline_queue_${this.cloud.tenantId || 'default'}`;
            }

            loadOfflineQueue() {
                try {
                    const raw = localStorage.getItem(this.getOfflineQueueKey());
                    const parsed = raw ? JSON.parse(raw) : [];
                    return Array.isArray(parsed) ? parsed : [];
                } catch (error) {
                    console.warn('No se pudo leer la cola offline:', error);
                    return [];
                }
            }

            saveOfflineQueue(queue) {
                localStorage.setItem(this.getOfflineQueueKey(), JSON.stringify(queue));
                this.updateSyncIndicator();
            }

            updateLocalRecordSilently(collectionName, id, updates) {
                const list = Array.isArray(this.data[collectionName]) ? this.data[collectionName] : [];
                const index = list.findIndex((item) => item.id === id);
                if (index === -1) return null;
                this.data[collectionName][index] = { ...this.data[collectionName][index], ...updates };
                this.save(collectionName);
                this.notify(collectionName);
                return this.data[collectionName][index];
            }

            getPendingOfflineOperations() {
                return this.loadOfflineQueue().filter((entry) => ['pending', 'retrying'].includes(entry.status));
            }

            getPendingOfflineOperationCount() {
                return this.getPendingOfflineOperations().length;
            }

            getBlockingOfflineOperations() {
                return this.loadOfflineQueue().filter((entry) => ['pending', 'retrying', 'conflict'].includes(entry.status));
            }

            getBlockingOfflineSummary() {
                const summary = { pending: 0, retrying: 0, conflict: 0, total: 0 };
                this.getBlockingOfflineOperations().forEach((entry) => {
                    if (entry.status === 'pending') summary.pending += 1;
                    if (entry.status === 'retrying') summary.retrying += 1;
                    if (entry.status === 'conflict') summary.conflict += 1;
                });
                summary.total = summary.pending + summary.retrying + summary.conflict;
                return summary;
            }

            getPendingStockProductIds() {
                const ids = new Set();
                this.getPendingOfflineOperations().forEach((entry) => {
                    if (entry.type !== 'sale-stock-sync') return;
                    (entry.items || []).forEach((item) => ids.add(item.id));
                });
                return ids;
            }

            updateSyncIndicator() {
                const pendingCount = this.getPendingOfflineOperationCount();
                const syncDot = document.getElementById('syncDot');
                const syncText = document.getElementById('syncText');
                if (!syncDot || !syncText) return;

                if (!navigator.onLine) {
                    syncDot.className = 'w-2 h-2 rounded-full bg-red-500';
                    syncText.textContent = pendingCount ? `Offline · ${pendingCount} pendientes` : 'Offline';
                    return;
                }

                if (pendingCount > 0) {
                    syncDot.className = 'w-2 h-2 rounded-full bg-amber-400';
                    syncText.textContent = `${pendingCount} pendientes`;
                    return;
                }

                syncDot.className = 'w-2 h-2 rounded-full status-online';
                syncText.textContent = 'Online';
            }

            createSaleSyncOperation(sale, options = {}) {
                return {
                    id: sale.syncOperationId,
                    type: 'sale-stock-sync',
                    tenantId: this.cloud.tenantId,
                    userId: this.cloud.userId,
                    saleId: sale.id,
                    ticket: sale.ticket,
                    items: (sale.items || []).map((item) => ({
                        id: item.id,
                        qty: Math.max(0, Number(item.qty || 0)),
                        name: item.name || 'Producto'
                    })),
                    externalOrderMeta: options.externalOrderMeta || null,
                    createdAt: Date.now(),
                    retries: 0,
                    status: 'pending',
                    lastError: null
                };
            }

            // ==================== CARGA HISTÓRICA BAJO DEMANDA ====================
            // Evita quota exceeded cargando solo datos recientes inicialmente
            // y permitiendo cargar datos antiguos cuando se necesiten
            
            async loadHistoricalData(collectionName, options = {}) {
                // Deprecated: historical load now handled by SupabaseDataStore
                return { data: [], hasMore: false };
            }

            // Cargar más ventas históricas (para reportes o paginación)
            async loadMoreSales(options = {}) {
                if (!this._sbDataStore || !this.cloud.tenantId) {
                    return { data: this.data.sales || [], hasMore: false };
                }
                const toISODate = (ts) => {
                    if (!ts) return null;
                    const d = new Date(ts);
                    return d.toISOString().split('T')[0];
                };
                const from = toISODate(options.startDate);
                const to = toISODate(options.endDate);
                try {
                    const rows = await this._sbDataStore.getSales(this.cloud.tenantId, from, to);
                    if (rows.length > 0) {
                        const existingIds = new Set(this.data.sales.map(s => s.id));
                        const newSales = rows.filter(s => !existingIds.has(s.id));
                        this.data.sales = [...this.data.sales, ...newSales].sort((a, b) =>
                            (b.createdAt || b.created_at || 0) - (a.createdAt || a.created_at || 0)
                        );
                        this.save('sales');
                        this.notify('sales');
                    }
                    return { data: rows, hasMore: false };
                } catch (err) {
                    console.warn('[DataStore] loadMoreSales failed:', err.message);
                    return { data: this.data.sales || [], hasMore: false, error: err.message };
                }
            }

            // Cargar más entregas históricas
            async loadMoreDeliveries(options = {}) {
                // Deprecated: deliveries now synced via SupabaseDataStore
                return { data: this.data.deliveries || [], hasMore: false };
            }

            queueOfflineOperation(operation) {
                const queue = this.loadOfflineQueue();
                const index = queue.findIndex((entry) => entry.id === operation.id);
                if (index >= 0) queue[index] = { ...queue[index], ...operation };
                else queue.push(operation);
                this.saveOfflineQueue(queue);
            }

            async applyExternalOrderInvoiceUpdate(tx, operation) {
                const meta = operation.externalOrderMeta;
                if (!meta?.tenantId || !meta?.orderId) return;

                tx.set(
                    doc(db, 'rw_tenants', meta.tenantId, 'incoming_orders', meta.orderId),
                    {
                        ...(meta.payload || {}),
                        status: 'invoiced',
                        linkedSaleId: operation.saleId,
                        updatedAt: serverTimestamp(),
                        invoicedAt: serverTimestamp()
                    },
                    { merge: true }
                );
            }

            async commitSaleStockOperation(operation) {
                if (!operation?.items?.length) return true;
                const tenantId = operation.tenantId || this.cloud.tenantId;
                if (!tenantId || !this._sbPkg?.supabase) {
                    return false;
                }
                const sb = this._sbPkg.supabase;
                for (const item of operation.items) {
                    const qty = Math.max(0, Number(item.qty || item.quantity || 0));
                    if (qty === 0) continue;
                    const { data: product, error: fetchErr } = await sb
                        .from('products')
                        .select('stock')
                        .eq('id', item.id)
                        .eq('tenant_id', tenantId)
                        .maybeSingle();
                    if (fetchErr) throw fetchErr;
                    const remoteStock = Math.max(0, Number(product?.stock || 0));
                    if (remoteStock < qty) {
                        const err = new Error(`Stock insuficiente para ${item.name}`);
                        err.code = 'stock-conflict';
                        throw err;
                    }
                    const { error } = await sb.rpc('decrement_stock', {
                        p_product_id: item.id,
                        p_quantity: qty,
                        p_tenant_id: tenantId,
                    });
                    if (error) throw error;
                }
                return true;
            }

            async processOfflineOperations() {
                if (this.offlineSync.processing || !navigator.onLine) {
                    this.updateSyncIndicator();
                    return;
                }
                if (!this.cloud.userId || !this.cloud.tenantId || this.cloud.tenantId === 'default') {
                    this.updateSyncIndicator();
                    return;
                }

                this.offlineSync.processing = true;

                try {
                    // Process SupabaseDataStore sync queue
                    if (this._sbDataStore) {
                        await this._sbDataStore.processSyncQueue();
                    }

                    // Process legacy sale-stock-sync queue
                    let queue = this.loadOfflineQueue();
                    if (queue.length) {
                        for (const operation of queue) {
                            if (!['pending', 'retrying'].includes(operation.status)) continue;
                            try {
                                if (operation.type === 'sale-stock-sync') {
                                    await this.commitSaleStockOperation(operation);
                                    this.updateLocalRecordSilently('sales', operation.saleId, {
                                        syncStatus: 'synced',
                                        syncedAt: Date.now(),
                                        syncError: null
                                    });
                                    operation.status = 'completed';
                                }
                            } catch (error) {
                                operation.retries = Number(operation.retries || 0) + 1;
                                operation.lastError = error?.message || String(error);

                                if (error?.code === 'stock-conflict') {
                                    operation.status = 'conflict';
                                    this.updateLocalRecordSilently('sales', operation.saleId, {
                                        syncStatus: 'conflict',
                                        syncError: operation.lastError,
                                        conflictAt: Date.now()
                                    });
                                    ui?.showToast?.(`Conflicto de stock: ${operation.lastError}`, 'error', 5000);
                                } else if (operation.retries >= this.offlineSync.maxRetries) {
                                    operation.status = 'failed';
                                    this.updateLocalRecordSilently('sales', operation.saleId, {
                                        syncStatus: 'failed',
                                        syncError: operation.lastError
                                    });
                                } else {
                                    operation.status = 'retrying';
                                    this.updateLocalRecordSilently('sales', operation.saleId, {
                                        syncStatus: 'pending',
                                        syncError: operation.lastError
                                    });
                                }
                            }
                        }
                        queue = queue.filter((entry) => entry.status !== 'completed' && entry.status !== 'failed');
                        this.saveOfflineQueue(queue);
                    }
                } finally {
                    this.offlineSync.processing = false;
                    this.updateSyncIndicator();
                }
            }

            getLocalStorageKey(collection) {
                const tenantId = this.cloud?.tenantId || 'default';
                return `rw_${tenantId}_${collection}`;
            }

            getTombstones(collection = null) {
                try {
                    const key = this.getLocalStorageKey('_tombstones');
                    const data = JSON.parse(localStorage.getItem(key) || '{}');
                    if (collection) return data[collection] || {};
                    return data;
                } catch(e) {
                    return {};
                }
            }

            applyTombstones() {
                const tombstones = this.getTombstones();
                for (const [collection, ids] of Object.entries(tombstones)) {
                    if (!Array.isArray(this.data[collection])) continue;
                    const before = this.data[collection].length;
                    this.data[collection] = this.data[collection].filter(item => !ids[item.id]);
                    if (this.data[collection].length !== before) {
                        this.save(collection);
                    }
                }
            }

            filterTenantScopedLocalData(collection, items) {
                if (!Array.isArray(items)) return [];
                const tenantId = this.cloud?.tenantId;
                if (!tenantId || !['sales','deliveries','deliveryEvents','trainingResults'].includes(collection)) return items;
                // Allow legacy items without tenantId (treat them as belonging to current tenant)
                return items.filter(item => !item?.tenantId || item?.tenantId === tenantId);
            }

            clearUnsegmentedLocalStorage() {
                const collections = ['products','categories','clients','sales','quotes','suppliers','users','promotions','purchases','deliveries','deliveryEvents','trainingResults','audit','locales','warehouses','warehouseStock','containerReceipts','transfers','replenishmentAlerts','expiryPromotions','demandForecasts','accountingAccounts','accountingEntries','taxes'];
                collections.forEach(col => {
                    try {
                        localStorage.removeItem('rw_' + col);
                    } catch (e) {
                        // ignore
                    }
                });
            }

            loadFromLocalStorage() {
                let loaded = false;
                const collections = ['products','categories','clients','sales','suppliers','users','promotions','purchases','deliveries','deliveryEvents','trainingResults','audit','locales','warehouses','warehouseStock','containerReceipts','transfers','replenishmentAlerts','expiryPromotions','demandForecasts','accountingAccounts','accountingEntries','taxes','loyaltyCards','walletTransactions','crmCoupons','crmCouponPurchases','reloadRequests','discountCampaigns','crmActivities'];
                collections.forEach(col => {
                    try {
                        const stored = localStorage.getItem(this.getLocalStorageKey(col));
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            // Solo cargar si el array tiene elementos (para impuestos, no sobrescribir con array vacío)
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                const filtered = this.filterTenantScopedLocalData(col, parsed);
                                if (filtered.length > 0) {
                                    this.data[col] = filtered;
                                    loaded = true;
                                }
                            }
                        }
                    } catch (e) {
                        console.warn(`No se pudo cargar ${col} de localStorage:`, e);
                    }
                });
                // Cargar objetos simples (no arrays) como cashRegister, cashRegisters y settings
                const objects = ['cashRegister', 'cashRegisters', 'settings'];
                objects.forEach(col => {
                    try {
                        const stored = localStorage.getItem(this.getLocalStorageKey(col));
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            if (parsed && typeof parsed === 'object') {
                                this.data[col] = parsed;
                                loaded = true;
                            }
                        }
                    } catch (e) {
                        console.warn(`No se pudo cargar ${col} de localStorage:`, e);
                    }
                });
                // Migrar sistema POS si es necesario
                this.migratePosTerminals();
                // Asegurar que exista warehouseStock para todos los productos
                this.ensureWarehouseStock();
                return loaded;
            }

            restoreLocalDeviceState() {
                // cashRegister, cashRegisters y settings.logoBase64 son estado local del dispositivo;
                // nunca deben ser sobrescritos por datos de la nube.
                try {
                    const crKey = this.getLocalStorageKey('cashRegister');
                    const crStored = localStorage.getItem(crKey);
                    if (crStored) {
                        const cr = JSON.parse(crStored);
                        if (cr && typeof cr === 'object') {
                            this.data.cashRegister = cr;
                        }
                    }
                } catch (e) {
                    console.warn('No se pudo restaurar cashRegister local:', e);
                }
                try {
                    const crsKey = this.getLocalStorageKey('cashRegisters');
                    const crsStored = localStorage.getItem(crsKey);
                    if (crsStored) {
                        const crs = JSON.parse(crsStored);
                        if (crs && typeof crs === 'object') {
                            this.data.cashRegisters = crs;
                        }
                    }
                } catch (e) {
                    console.warn('No se pudo restaurar cashRegisters local:', e);
                }
                try {
                    const stKey = this.getLocalStorageKey('settings');
                    const stStored = localStorage.getItem(stKey);
                    if (stStored) {
                        const st = JSON.parse(stStored);
                        if (st?.logoBase64) {
                            if (!this.data.settings) this.data.settings = {};
                            this.data.settings.logoBase64 = st.logoBase64;
                        }
                    }
                } catch (e) {
                    console.warn('No se pudo restaurar logo local:', e);
                }
            }

            async connectCloud(user, tenantContext = null) {
                const userId = user?.uid || user?.id;
                if (!userId) return;
                this.cloud.userId = userId;
                this.cloud.tenantId = tenantContext?.id || tenantContext?.tenantId || 'default';
                this.cloud.sharedStoreId = this.normalizeSharedStoreId(tenantContext?.sharedStoreId);
                this.cloud.isHydrating = true;

                // Prevenir contaminación cruzada entre tenants
                this.clearUnsegmentedLocalStorage();
                this.data = this.createEmptyData();

                this.loadFromLocalStorage();
                this.ensureTaxesExist();
                this.ensureLocalScopedData();

                try {
                    if (!window.SupabaseClient) throw new Error('SupabaseClient no disponible');
                    this._sbPkg = await window.SupabaseClient.init();
                    this._sbDataStore = this._sbPkg.dataStore;
                    this._sbDataStore.setTenant(this.cloud.tenantId, this.cloud.userId);
                    this._sbDataStore.setLocale(AppState.currentLocalId);

                    if (navigator.onLine) {
                        await this._sbDataStore.syncAllTables(this.cloud.tenantId);
                        this._mergeRemoteData(this._sbDataStore);
                        this.cloud.hasLoadedCloudData = true;
                        this.cloud.isOffline = false;
                    } else {
                        this.cloud.isOffline = true;
                    }

                    this._startSupabaseRealtime(this._sbDataStore);

                    this.ensureDefaultLocal();
                    this.ensureLocalScopedData();
                    this.cloud.isHydrating = false;
                    this.notifyAll();
                    this.updateSyncIndicator();
                } catch (error) {
                    console.error('[DataStore] Error conectando con Supabase:', error?.message || error);
                    console.warn('[DataStore] Usando modo offline con localStorage');
                    this.cloud.isOffline = true;
                    this.cloud.isHydrating = false;
                    this.notifyAll();
                    this.updateSyncIndicator();
                }
            }

            disconnectCloud() {
                this.cloud.userId = null;
                if (this.cloud.saveTimer) {
                    clearTimeout(this.cloud.saveTimer);
                    this.cloud.saveTimer = null;
                }
                if (this.cloud.catalogUnsub) {
                    try { this.cloud.catalogUnsub(); } catch (e) {}
                    this.cloud.catalogUnsub = null;
                }
                if (this._sbDataStore) {
                    try { this._sbDataStore.unsubscribeAll(); } catch (e) {}
                    this._sbDataStore = null;
                }
                this._sbPkg = null;
                this.updateSyncIndicator();
            }

            // --- Supabase integration helpers ---

            _mergeRemoteData(sbDS) {
                const tables = [
                    'products','categories','clients','locales','sales','purchases',
                    'suppliers','warehouses','warehouseStock','taxes','posTerminals',
                    'loyaltyCards','wallet_transactions','crm_coupons','discount_campaigns',
                    'pos_terminals','transfers','inventoryMovements'
                ];
                const changedTables = [];
                tables.forEach(tbl => {
                    const remote = sbDS.getAll(tbl);
                    if (!remote || !remote.length) return;
                    const local = this.data[tbl] || [];
                    const merged = [...local];
                    remote.forEach(rItem => {
                        let idx = merged.findIndex(l => l.id === rItem.id);
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
                            const rTime = new Date(rItem.updatedAt || rItem.createdAt || rItem.updated_at || rItem.created_at || 0).getTime();
                            const lTime = new Date(merged[idx].updatedAt || merged[idx].createdAt || merged[idx].updated_at || merged[idx].created_at || 0).getTime();
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
                });
                if (changedTables.length) {
                    this.notifyAll();
                    [...new Set(changedTables)].forEach(tbl => this.notify(tbl));
                }
            }

            _startSupabaseRealtime(sbDS) {
                const tenantId = this.cloud.tenantId;
                if (!tenantId) return;
                const tables = [
                    'products', 'categories', 'clients', 'sales', 'purchases',
                    'suppliers', 'warehouses', 'warehouseStock', 'inventoryMovements',
                    'transfers', 'posTerminals', 'taxes', 'locales'
                ];
                sbDS.subscribeRealtimeAll(tables, tenantId, (table, payload) => this._applyRealtimeChange(table, payload));
            }

            _applyRealtimeChange(table, payload) {
                const { eventType, new: newRec } = payload;
                if (!newRec || typeof newRec !== 'object') return;
                const rec = {};
                Object.entries(newRec).forEach(([k, v]) => {
                    if (k === 'id' || k === 'tenant_id' || k === 'user_id' || k.startsWith('_')) {
                        rec[k] = v;
                    } else {
                        rec[k.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] = v;
                    }
                });
                if (table === 'products' && (rec.category || rec.categoryId)) {
                    const categories = this.data?.categories || [];
                    if (rec.category && categories.length) {
                        const found = categories.find(c => c.id === rec.category);
                        if (found) rec.categoryName = found.name;
                    }
                    if (rec.categoryId && !rec.category && categories.length) {
                        const found = categories.find(c => c.id === rec.categoryId);
                        if (found) rec.category = found.name;
                    }
                }
                if (table === 'clients' && rec.credit == null && rec.creditLimit != null) {
                    rec.credit = rec.creditLimit;
                }
                const data = this.data[table] || [];
                if (eventType === 'INSERT') {
                    if (!data.find(d => d.id === rec.id)) { data.push(rec); this.save(table); this.notify(table); }
                } else if (eventType === 'UPDATE') {
                    const idx = data.findIndex(d => d.id === rec.id);
                    if (idx >= 0) { data[idx] = { ...data[idx], ...rec }; this.save(table); this.notify(table); }
                    else { data.push(rec); this.save(table); this.notify(table); }
                } else if (eventType === 'DELETE') {
                    this.data[table] = data.filter(d => d.id !== rec.id); this.save(table); this.notify(table);
                }
            }

            startCatalogListener() {
                if (!this.cloud.tenantId || this.cloud.tenantId === 'default' || this.cloud.catalogUnsub) return;
                try {
                    const catalogCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'catalog');
                    this.cloud.catalogUnsub = onSnapshot(catalogCol, (snap) => {
                        if (!Array.isArray(this.data.products)) return;
                        let changed = false;
                        snap.docChanges().forEach(change => {
                            const remote = { id: change.doc.id, ...change.doc.data() };
                            const idx = this.data.products.findIndex(p => p.id === remote.id);
                            if (change.type === 'removed') {
                                if (idx >= 0) {
                                    this.data.products.splice(idx, 1);
                                    changed = true;
                                }
                            } else {
                                // added or modified
                                const merged = idx >= 0
                                    ? { ...this.data.products[idx], ...remote, _syncedAt: Date.now() }
                                    : { ...remote, _syncedAt: Date.now() };
                                if (idx >= 0) {
                                    this.data.products[idx] = merged;
                                } else {
                                    this.data.products.push(merged);
                                }
                                changed = true;
                            }
                        });
                        if (changed) {
                            this.save('products');
                            this.notify('products');
                            console.log('[DataStore] Catalog synced from onSnapshot');
                        }
                    }, err => {
                        console.warn('[DataStore] Catalog listener error:', err);
                    });
                    console.log('[DataStore] Catalog onSnapshot listener started');
                } catch (e) {
                    console.warn('[DataStore] Could not start catalog listener:', e);
                }
            }

            async hydrateMissingProductImagesFromCatalog() {
                // Deprecated: product images now come from Supabase via SupabaseDataStore
                return;
            }

            mergeWithDefaultShape(remoteData, localSnapshot = {}) {
                const fallback = this.createEmptyData();

                const merged = { ...fallback, ...remoteData };
                if (!Array.isArray(merged.products)) merged.products = [];
                if (!Array.isArray(merged.categories)) merged.categories = [];
                if (!Array.isArray(merged.clients)) merged.clients = [];
                if (!Array.isArray(merged.sales)) merged.sales = [];
                if (!Array.isArray(merged.suppliers)) merged.suppliers = [];
                if (!Array.isArray(merged.users)) merged.users = [];
                if (!Array.isArray(merged.promotions)) merged.promotions = [];
                if (!Array.isArray(merged.purchases)) merged.purchases = [];
                if (!Array.isArray(merged.containerReceipts)) merged.containerReceipts = [];
                if (!Array.isArray(merged.deliveries)) merged.deliveries = [];
                if (!Array.isArray(merged.deliveryEvents)) merged.deliveryEvents = [];
                if (!Array.isArray(merged.audit)) merged.audit = [];
                if (!Array.isArray(merged.warehouses)) merged.warehouses = [];
                if (!Array.isArray(merged.taxes)) merged.taxes = [];
                if (!Array.isArray(merged.warehouseStock)) merged.warehouseStock = [];
                if (!Array.isArray(merged.transfers)) merged.transfers = [];
                if (!Array.isArray(merged.replenishmentAlerts)) merged.replenishmentAlerts = [];
                if (!Array.isArray(merged.expiryPromotions)) merged.expiryPromotions = [];
                if (!Array.isArray(merged.demandForecasts)) merged.demandForecasts = [];
                if (!Array.isArray(merged.quotes)) merged.quotes = [];
                if (!Array.isArray(merged.trainingResults)) merged.trainingResults = [];
                if (!Array.isArray(merged.inventoryMovements)) merged.inventoryMovements = [];
                if (!Array.isArray(merged.accountingAccounts)) merged.accountingAccounts = [];
                if (!Array.isArray(merged.accountingEntries)) merged.accountingEntries = [];
                if (!merged.cashRegister || typeof merged.cashRegister !== 'object') {
                    merged.cashRegister = fallback.cashRegister;
                }
                if (!merged.settings || typeof merged.settings !== 'object') merged.settings = fallback.settings;
                if (!merged.settings.currency) merged.settings.currency = 'XAF';
                if (!merged.settings.billing || typeof merged.settings.billing !== 'object') {
                    merged.settings.billing = fallback.settings.billing;
                }

                const localProducts = Array.isArray(localSnapshot?.products) ? localSnapshot.products : [];
                if (localProducts.length && Array.isArray(merged.products)) {
                    const localImageMap = new Map();
                    localProducts.forEach((product) => {
                        if (!product?.image) return;
                        [product.id, product.sku, product.name]
                            .map((value) => String(value || '').trim().toLowerCase())
                            .filter(Boolean)
                            .forEach((key) => localImageMap.set(key, product.image));
                    });

                    merged.products = merged.products.map((product) => {
                        if (!product || typeof product !== 'object' || product.image) return product;
                        const restoredImage = [product.id, product.sku, product.name]
                            .map((value) => String(value || '').trim().toLowerCase())
                            .filter(Boolean)
                            .map((key) => localImageMap.get(key))
                            .find(Boolean);
                        return restoredImage ? { ...product, image: restoredImage } : product;
                    });
                }

                return merged;
            }

            persistAllLocal() {
                Object.keys(this.data).forEach(key => this.save(key));
            }

            scheduleCloudSave() {
                if (!this.cloud.enabled || !this.cloud.userId || this.cloud.isHydrating) return;
                if (AppState?.practicalExam) {
                    console.log('[DataStore] Practical exam active - skipping cloud save scheduling');
                    return;
                }
                if (this.cloud.saveTimer) clearTimeout(this.cloud.saveTimer);
                this.cloud.saveTimer = setTimeout(() => {
                    this.saveCloudNow();
                }, 3000);
            }

            async syncTenantCatalog() {
                // Deprecated: products now synced via SupabaseDataStore
                return;
            }

            async pullTenantDeliveries(options = {}) {
                // Deprecated: deliveries now synced via SupabaseDataStore
                return;
            }

            async pullTenantClients() {
                // Deprecated: clients now synced via SupabaseDataStore
                return;
            }

            async syncTenantClients() {
                // Deprecated: clients now synced via SupabaseDataStore
                return;
            }

            compactCollectionForCloud(collection, maxItems, fields = null) {
                if (!Array.isArray(collection)) return [];
                const limit = Math.max(0, Number(maxItems) || collection.length || 0);
                return collection.slice(-limit).map((item) => this.pickCloudFields(item, fields));
            }

            pickCloudFields(item, fields = null) {
                if (item === null || item === undefined) return item;
                if (Array.isArray(item)) {
                    return item
                        .slice(0, 20)
                        .map((entry) => this.pickCloudFields(entry))
                        .filter((entry) => entry !== undefined);
                }
                if (typeof item !== 'object') {
                    return typeof item === 'string' && item.length > 250 ? `${item.slice(0, 250)}…` : item;
                }

                const source = item;
                const keys = Array.isArray(fields) && fields.length > 0 ? fields : Object.keys(source);
                const cleaned = {};

                for (const key of keys) {
                    if (!(key in source)) continue;
                    const value = source[key];
                    if (value === undefined) continue;

                    if (typeof value === 'string') {
                        const lowerKey = key.toLowerCase();
                        if ((lowerKey.includes('image') || lowerKey.includes('photo') || lowerKey.includes('logo') || lowerKey.includes('signature')) && value.startsWith('data:')) {
                            cleaned[key] = null;
                        } else {
                            cleaned[key] = value.length > 250 ? `${value.slice(0, 250)}…` : value;
                        }
                        continue;
                    }

                    if (Array.isArray(value)) {
                        cleaned[key] = value
                            .slice(0, 20)
                            .map((entry) => this.pickCloudFields(entry, ['id', 'productId', 'productName', 'name', 'sku', 'qty', 'quantity', 'price', 'total', 'amount', 'type', 'status', 'date', 'time', 'warehouseId', 'lotNumber', 'expiryDate', 'mode', 'variantKey', 'stockUnits']))
                            .filter((entry) => entry !== undefined);
                        continue;
                    }

                    if (value && typeof value === 'object') {
                        cleaned[key] = this.pickCloudFields(value);
                        continue;
                    }

                    cleaned[key] = value;
                }

                return this.removeUndefinedValues(cleaned);
            }

            compactProductsForCloud(products, maxItems = 100) {
                if (!Array.isArray(products)) return [];
                const limitedProducts = products.slice(-Math.max(0, Number(maxItems) || 100));
                return limitedProducts.map((product) => {
                    if (!product || typeof product !== 'object') return product;
                    // Only keep essential fields
                    return {
                        id: product.id,
                        name: product.name,
                        sku: product.sku,
                        category: product.category,
                        price: product.price,
                        cost: product.cost,
                        stock: product.stock,
                        minStock: product.minStock,
                        active: product.active,
                        hasVariants: product.hasVariants,
                        hasExpiry: product.hasExpiry,
                        lotNumber: product.lotNumber,
                        expiryDate: product.expiryDate,
                        createdAt: product.createdAt,
                        unitsPerBox: product.unitsPerBox,
                        boxPrice: product.boxPrice,
                        halfBoxPrice: product.halfBoxPrice,
                        variants: this.pickCloudFields(product.variants || [], ['key', 'label', 'stock', 'sku', 'size', 'color']),
                        variantes: this.pickCloudFields(product.variantes || [], ['key', 'label', 'stock', 'sku', 'size', 'color']),
                        // Keep image only if it's small (not base64)
                        image: (typeof product.image === 'string' && product.image.startsWith('data:')) ? null : product.image
                    };
                });
            }

            compactCashRegisterForCloud(cashRegister) {
                const current = cashRegister && typeof cashRegister === 'object'
                    ? cashRegister
                    : { isOpen: false, openingAmount: 0, currentAmount: 0, movements: [] };

                return this.removeUndefinedValues({
                    isOpen: !!current.isOpen,
                    openingAmount: Number(current.openingAmount || 0),
                    currentAmount: Number(current.currentAmount || 0),
                    closingAmount: Number(current.closingAmount || 0),
                    openedAt: current.openedAt || null,
                    closedAt: current.closedAt || null,
                    movements: this.compactCollectionForCloud(current.movements || [], 40, ['type', 'amount', 'concept', 'time', 'ticket', 'paymentMethod', 'userName'])
                });
            }

            // Calculate approximate size of data in bytes
            estimateDataSize(data) {
                try {
                    return new Blob([JSON.stringify(data)]).size;
                } catch (e) {
                    return 0;
                }
            }

            // Remove undefined values from object (Firestore doesn't accept undefined)
            removeUndefinedValues(obj) {
                if (obj === null || typeof obj !== 'object') {
                    return obj;
                }
                if (obj instanceof Date) {
                    return obj;
                }
                if (Array.isArray(obj)) {
                    return obj
                        .filter((item) => item !== undefined)
                        .map((item) => this.removeUndefinedValues(item))
                        .filter((item) => item !== undefined);
                }
                const cleaned = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (value !== undefined) {
                        cleaned[key] = this.removeUndefinedValues(value);
                    }
                }
                return cleaned;
            }

            buildCloudStoreData(minimalMode = false) {
                const compacted = {
                    settings: this.removeUndefinedValues(this.data.settings || {}),
                    users: this.compactCollectionForCloud(this.data.users, minimalMode ? 20 : 40, ['id', 'uid', 'name', 'email', 'role', 'active', 'createdAt', 'updatedAt']),
                    products: this.compactProductsForCloud(this.data.products, minimalMode ? 60 : 80),
                    categories: this.compactCollectionForCloud(this.data.categories, 50, ['id', 'name', 'color', 'icon']),
                    locales: this.compactCollectionForCloud(this.data.locales, 20, ['id', 'name', 'address', 'phone', 'email', 'isDefault', 'isActive', 'createdAt']),
                    warehouses: this.compactCollectionForCloud(this.data.warehouses, 20, ['id', 'name', 'type', 'location', 'isDefault', 'minStockAlert', 'createdAt']),
                    warehouseStock: this.compactCollectionForCloud(this.data.warehouseStock, minimalMode ? 120 : 180, ['id', 'productId', 'warehouseId', 'quantity', 'lotNumber', 'expiryDate', 'variantKey', 'updatedAt', 'createdAt']),
                    inventoryMovements: this.compactCollectionForCloud(this.data.inventoryMovements, minimalMode ? 100 : 200, ['id', 'productId', 'warehouseId', 'type', 'referenceId', 'lotNumber', 'expiryDate', 'variantKey', 'quantity', 'runningBalance', 'userName', 'timestamp']),
                    sales: this.compactCollectionForCloud(this.data.sales, minimalMode ? 30 : 60, ['id', 'ticket', 'date', 'clientId', 'clientName', 'items', 'subtotal', 'tax', 'discount', 'total', 'paymentMethod', 'status', 'paid', 'balance', 'createdAt']),
                    quotes: this.compactCollectionForCloud(this.data.quotes, minimalMode ? 20 : 40, ['id', 'quoteNumber', 'date', 'expiryDate', 'clientId', 'clientName', 'items', 'subtotal', 'tax', 'discount', 'total', 'status', 'notes', 'createdAt']),
                    trainingResults: this.compactCollectionForCloud(this.data.trainingResults, minimalMode ? 20 : 40, ['id', 'userId', 'userName', 'userEmail', 'itScore', 'riverScore', 'totalScore', 'maxScore', 'answers', 'passed', 'createdAt']),
                    purchases: this.compactCollectionForCloud(this.data.purchases, minimalMode ? 20 : 40, ['id', 'orderNumber', 'date', 'supplierId', 'supplierName', 'items', 'subtotal', 'tax', 'total', 'status', 'warehouseId', 'notes', 'sentAt', 'receivedAt', 'invoicedAt', 'createdAt', 'updatedAt']),
                    containerReceipts: this.compactCollectionForCloud(this.data.containerReceipts, minimalMode ? 15 : 30, ['id', 'containerNumber', 'blNumber', 'supplierId', 'supplierName', 'purchaseIds', 'warehouseId', 'manifestCurrency', 'exchangeRate', 'manifestItems', 'costs', 'costAllocationMethod', 'manifestTotalForeign', 'manifestTotalFCFA', 'totalCostsFCFA', 'finalTotalFCFA', 'status', 'departureDate', 'estimatedArrival', 'actualArrival', 'receiptDate', 'notes', 'createdAt', 'updatedAt']),
                    transfers: this.compactCollectionForCloud(this.data.transfers, minimalMode ? 20 : 40, ['id', 'fromWarehouseId', 'toWarehouseId', 'items', 'status', 'notes', 'createdAt', 'completedAt']),
                    clients: this.compactCollectionForCloud(this.data.clients, minimalMode ? 40 : 80, ['id', 'firstName', 'lastName', 'phone', 'email', 'taxId', 'address', 'credit', 'purchases', 'createdAt', 'updatedAt']),
                    suppliers: this.compactCollectionForCloud(this.data.suppliers, minimalMode ? 20 : 40, ['id', 'name', 'phone', 'email', 'address', 'contactPerson', 'createdAt', 'updatedAt']),
                    audit: this.compactCollectionForCloud(this.data.audit, minimalMode ? 50 : 100, ['id', 'action', 'collection', 'itemId', 'userId', 'userName', 'timestamp', 'details']),
                    deliveries: this.compactCollectionForCloud(this.data.deliveries, minimalMode ? 30 : 60, ['id', 'clientId', 'clientName', 'status', 'address', 'phone', 'trackingCode', 'date', 'items', 'total', 'createdAt', 'updatedAt']),
                    deliveryEvents: this.compactCollectionForCloud(this.data.deliveryEvents, minimalMode ? 30 : 60, ['id', 'deliveryId', 'status', 'note', 'changedAt', 'createdAt']),
                    promotions: this.compactCollectionForCloud(this.data.promotions, minimalMode ? 20 : 30, ['id', 'name', 'type', 'value', 'productId', 'category', 'active', 'startDate', 'endDate', 'createdAt']),
                    replenishmentAlerts: this.compactCollectionForCloud(this.data.replenishmentAlerts, minimalMode ? 30 : 60, ['id', 'productId', 'productName', 'warehouseId', 'warehouseName', 'currentStock', 'minStock', 'status', 'createdAt']),
                    expiryPromotions: this.compactCollectionForCloud(this.data.expiryPromotions, minimalMode ? 30 : 60, ['id', 'productId', 'productName', 'discount', 'expiryDate', 'status', 'createdAt']),
                    demandForecasts: this.compactCollectionForCloud(this.data.demandForecasts, minimalMode ? 30 : 60, ['productId', 'totalSold', 'dailyAverage', 'currentStock', 'daysRemaining', 'suggestedReorderDate', 'reorderPoint']),
                    taxes: this.compactCollectionForCloud(this.data.taxes, 20, ['id', 'name', 'rate', 'isDefault', 'active', 'description']),
                    cashRegister: this.compactCashRegisterForCloud(this.data.cashRegister),
                    cashMovements: this.compactCollectionForCloud(this.data.cashMovements, minimalMode ? 20 : 40, ['id', 'type', 'amount', 'concept', 'time', 'ticket', 'paymentMethod', 'userName']),
                    accountingConfigs: this.removeUndefinedValues(this.data.accountingConfigs || {}),
                    accountingAccounts: this.compactCollectionForCloud(this.data.accountingAccounts, minimalMode ? 80 : 120, ['id', 'code', 'name', 'type', 'nature', 'class', 'description', 'active']),
                    accountingEntries: this.compactCollectionForCloud(this.data.accountingEntries, minimalMode ? 40 : 80, ['id', 'number', 'date', 'description', 'reference', 'debitTotal', 'creditTotal', 'status', 'createdAt', 'lines']),
                    _cloudMeta: {
                        generatedAt: Date.now(),
                        compacted: true,
                        minimalMode: !!minimalMode,
                        version: 3
                    }
                };

                const estimatedSize = this.estimateDataSize(compacted);
                if (!minimalMode && estimatedSize > 850000) {
                    console.warn(`Cloud data snapshot too large (${Math.round(estimatedSize / 1024)}KB). Falling back to minimal snapshot.`);
                    return this.buildCloudStoreData(true);
                }
                if (estimatedSize > 900000) {
                    console.warn(`Cloud data size warning: ${Math.round(estimatedSize / 1024)}KB - approaching Firestore limit`);
                }

                return this.removeUndefinedValues(compacted);
            }

            toTimestampMs(value) {
                if (typeof value === 'number' && Number.isFinite(value)) return value;
                if (value && typeof value.toDate === 'function') {
                    const dateValue = value.toDate();
                    return dateValue instanceof Date ? dateValue.getTime() : 0;
                }
                const parsed = new Date(value || 0).getTime();
                return Number.isFinite(parsed) ? parsed : 0;
            }

            // Save pending changes to Supabase
            async saveCloudNow() {
                if (this._isSavingCloud) {
                    console.warn('[DataStore] saveCloudNow skipped: another save is in progress');
                    return;
                }
                this._isSavingCloud = true;
                try {
                    if (!this.cloud.enabled || !this.cloud.userId || !this.cloud.tenantId) return;
                    if (AppState?.practicalExam) {
                        console.log('[DataStore] Practical exam active - skipping cloud save');
                        return;
                    }

                    if (this._sbDataStore) {
                        await this._sbDataStore.processSyncQueue();
                    }
                    this.updateSyncIndicator();
                } catch (error) {
                    console.error('[DataStore] Error sincronizando con Supabase:', error);
                } finally {
                    this._isSavingCloud = false;
                }
            }

            // NEW: Save each collection as separate documents in subcollections
            async saveToSubcollections() {
                const scopeId = this.getCloudDataScopeId();
                const userRef = doc(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId);
                const batch = writeBatch(db);
                const now = serverTimestamp();
                const canPurgeOrphans = this.cloud.hasLoadedCloudData;

                if (!canPurgeOrphans) {
                    console.warn('[DataStore] Cloud data no fully loaded; skipping orphan purge for master collections.');
                }

                // 1. Save settings/metadata (shared tenant document)
                // NO guardar storeData snapshot legacy para evitar que el flag needsSharedMigration
                // dispare migraciones constantes y reescrituras.
                // No sincronizar cashRegister ni logoBase64 con la nube (estado local del dispositivo)
                const settingsForCloud = this.removeUndefinedValues({ ...(this.data.settings || {}) });
                delete settingsForCloud.logoBase64;
                // Sincronizar estado de cajas (sin movimientos locales) para visibilidad multi-usuario
                const cashRegisterStates = {};
                for (const [tid, cr] of Object.entries(this.data.cashRegisters || {})) {
                    cashRegisterStates[tid] = {
                        isOpen: !!cr.isOpen,
                        openedBy: cr.openedBy || null,
                        openedByName: cr.openedByName || null,
                        openedAt: cr.openedAt || null,
                        closedAt: cr.closedAt || null,
                        closedBy: cr.closedBy || null,
                        closedByName: cr.closedByName || null
                    };
                }
                const settingsData = {
                    settings: settingsForCloud,
                    accountingConfigs: this.removeUndefinedValues(this.data.accountingConfigs || {}),
                    storeData: deleteField(),
                    currency: this.data.settings?.currency || 'XAF',
                    updatedAt: now,
                    updatedBy: this.cloud.userId,
                    version: 2,
                    storageType: 'subcollections',
                    scopeId,
                    scopeMode: 'tenant-shared',
                    cashRegisterStates
                };
                batch.set(userRef, settingsData, { merge: true });

                // 2. Save products as individual documents
                const productsCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'products');
                const productIds = new Set();

                if (Array.isArray(this.data.products)) {
                    for (const product of this.data.products.slice(-200)) { // Keep last 200
                        if (product?.id) {
                            productIds.add(product.id);
                            const cleanProduct = this.removeUndefinedValues({
                                ...product,
                                image: (typeof product.image === 'string' && product.image.startsWith('data:')) ? null : product.image,
                                _syncedAt: Date.now()
                            });
                            batch.set(doc(productsCol, product.id), cleanProduct, { merge: true });
                        }
                    }
                }

                // OPTIMIZACIÓN: Product orphan purge desactivado para reducir lecturas
                // const existingProductsSnap = await getDocs(productsCol);
                // if (!canPurgeOrphans) { ... }

                // 3. Save clients as individual documents + wipe orphans
                if (Array.isArray(this.data.clients)) {
                    const clientsCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'clients');
                    const clientIds = new Set();
                    for (const client of this.data.clients.slice(-300)) { // Keep last 300
                        if (client?.id) {
                            clientIds.add(client.id);
                            batch.set(doc(clientsCol, client.id), this.removeUndefinedValues({
                                ...client,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    // OPTIMIZACIÓN: Client orphan purge desactivado para reducir lecturas
                    // const existingClientsSnap = await getDocs(clientsCol);
                }

                // 4. Save users as individual documents + wipe orphans
                if (Array.isArray(this.data.users)) {
                    const usersCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'users');
                    const userIds = new Set();
                    for (const businessUser of this.data.users.slice(-100)) {
                        const userDocId = String(businessUser?.id || businessUser?.uid || businessUser?.email || '').trim();
                        if (userDocId) {
                            userIds.add(userDocId);
                            batch.set(doc(usersCol, userDocId), this.removeUndefinedValues({
                                ...businessUser,
                                id: userDocId,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    // OPTIMIZACIÓN: User orphan purge desactivado para reducir lecturas
                    // const existingUsersSnap = await getDocs(usersCol);
                }

                // 5. Save locales
                if (Array.isArray(this.data.locales)) {
                    const localesCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'locales');
                    const localIds = new Set();
                    for (const local of this.data.locales) {
                        if (local?.id) {
                            localIds.add(local.id);
                            batch.set(doc(localesCol, local.id), this.removeUndefinedValues({
                                ...local,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                }

                // 6. Save deliveries and events
                const deliveriesCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'deliveries');

                // OPTIMIZACIÓN: Delivery sync simplificado (sin getDocs de huérfanos)
                const deliveryIds = new Set();
                if (Array.isArray(this.data.deliveries)) {
                    for (const delivery of this.data.deliveries.slice(-100)) {
                        if (delivery?.id) {
                            deliveryIds.add(delivery.id);
                            batch.set(doc(deliveriesCol, delivery.id), this.removeUndefinedValues({
                                ...delivery,
                                tenantId: this.cloud.tenantId,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                }

                if (Array.isArray(this.data.deliveryEvents)) {
                    const eventsCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'deliveryEvents');
                    for (const event of this.data.deliveryEvents.slice(-500)) {
                        const eventId = String(event?.id || `${event.deliveryId || 'delivery'}_${event.changedAt || event.createdAt || Date.now()}`)
                            .replace(/[^a-zA-Z0-9_-]/g, '_');
                        if (eventId) {
                            batch.set(doc(eventsCol, eventId), this.removeUndefinedValues({
                                ...event,
                                id: eventId,
                                tenantId: this.cloud.tenantId,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                }

                // Helper para eliminar documentos huérfanos de Firestore usando tombstones
                // (evita costosas queries de listado completo; solo elimina IDs conocidos como borrados)
                const wipeOrphans = async (colRef, localIdsSet, collectionName) => {
                    if (!canPurgeOrphans) return;
                    const tombstones = this.getTombstones(collectionName);
                    const ids = Object.keys(tombstones || {});
                    if (!ids.length) return;
                    let deleted = 0;
                    const MAX_PURGE_PER_SYNC = 20;
                    for (const id of ids.slice(0, MAX_PURGE_PER_SYNC)) {
                        if (!localIdsSet.has(id)) {
                            batch.delete(doc(colRef, id));
                            deleted++;
                        }
                    }
                    if (deleted) {
                        console.log(`[DataStore] ${collectionName}: queued ${deleted} tombstoned docs for deletion`);
                    }
                };

                // 6. Save recent sales (last 3 months) as individual documents + wipe orphans
                if (Array.isArray(this.data.sales)) {
                    const threeMonthsAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
                    const recentSales = this.data.sales.filter((s) => this.toTimestampMs(s.date || s.createdAt) >= threeMonthsAgo);
                    const salesCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'sales');
                    const localSaleIds = new Set();
                    for (const sale of recentSales.slice(-500)) { // Keep last 500 recent
                        if (sale?.id) {
                            localSaleIds.add(sale.id);
                            batch.set(doc(salesCol, sale.id), this.removeUndefinedValues({
                                ...sale,
                                tenantId: this.cloud.tenantId,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(salesCol, localSaleIds, 'sales');
                }

                // Save purchases + wipe orphans
                if (Array.isArray(this.data.purchases)) {
                    const purchasesCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'purchases');
                    const localPurchaseIds = new Set();
                    for (const purchase of this.data.purchases.slice(-200)) {
                        if (purchase?.id) {
                            localPurchaseIds.add(purchase.id);
                            batch.set(doc(purchasesCol, purchase.id), this.removeUndefinedValues({
                                ...purchase,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(purchasesCol, localPurchaseIds, 'purchases');
                }

                // Save containerReceipts + wipe orphans
                if (Array.isArray(this.data.containerReceipts)) {
                    const crCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'containerReceipts');
                    const localCrIds = new Set();
                    for (const cr of this.data.containerReceipts.slice(-100)) {
                        if (cr?.id) {
                            localCrIds.add(cr.id);
                            batch.set(doc(crCol, cr.id), this.removeUndefinedValues({
                                ...cr,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(crCol, localCrIds, 'containerReceipts');
                }

                // Save transfers + wipe orphans
                if (Array.isArray(this.data.transfers)) {
                    const transfersCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'transfers');
                    const localTransferIds = new Set();
                    for (const transfer of this.data.transfers.slice(-100)) {
                        if (transfer?.id) {
                            localTransferIds.add(transfer.id);
                            batch.set(doc(transfersCol, transfer.id), this.removeUndefinedValues({
                                ...transfer,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(transfersCol, localTransferIds, 'transfers');
                }

                // Save quotes + wipe orphans
                if (Array.isArray(this.data.quotes)) {
                    const quotesCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'quotes');
                    const localQuoteIds = new Set();
                    for (const quote of this.data.quotes.slice(-100)) {
                        if (quote?.id) {
                            localQuoteIds.add(quote.id);
                            batch.set(doc(quotesCol, quote.id), this.removeUndefinedValues({
                                ...quote,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(quotesCol, localQuoteIds, 'quotes');
                }

                // Save trainingResults + wipe orphans
                if (Array.isArray(this.data.trainingResults)) {
                    const trainingCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'trainingResults');
                    const localTrainingIds = new Set();
                    for (const result of this.data.trainingResults.slice(-100)) {
                        if (result?.id) {
                            localTrainingIds.add(result.id);
                            batch.set(doc(trainingCol, result.id), this.removeUndefinedValues({
                                ...result,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(trainingCol, localTrainingIds, 'trainingResults');
                }

                // 6. Save suppliers + wipe orphans
                if (Array.isArray(this.data.suppliers)) {
                    const suppliersCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'suppliers');
                    const supplierIds = new Set();
                    for (const supplier of this.data.suppliers.slice(-50)) {
                        if (supplier?.id) {
                            supplierIds.add(supplier.id);
                            batch.set(doc(suppliersCol, supplier.id), this.removeUndefinedValues({
                                ...supplier,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    // OPTIMIZACIÓN: Supplier orphan purge desactivado para reducir lecturas
                    // const existingSuppliersSnap = await getDocs(suppliersCol);
                }

                // 6. Save categories + wipe orphans
                if (Array.isArray(this.data.categories)) {
                    const categoriesCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'categories');
                    const categoryIds = new Set();
                    for (const category of this.data.categories) {
                        if (category?.id || category?.name) {
                            const id = category.id || category.name;
                            categoryIds.add(id);
                            batch.set(doc(categoriesCol, id), this.removeUndefinedValues({
                                ...category,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    // OPTIMIZACIÓN: Category orphan purge desactivado para reducir lecturas
                    // const existingCategoriesSnap = await getDocs(categoriesCol);
                }

                // 7. Save warehouses and stock + wipe orphans
                if (Array.isArray(this.data.warehouses)) {
                    const warehousesCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'warehouses');
                    const warehouseIds = new Set();
                    for (const wh of this.data.warehouses) {
                        if (wh?.id) {
                            warehouseIds.add(wh.id);
                            batch.set(doc(warehousesCol, wh.id), this.removeUndefinedValues({
                                ...wh,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    // OPTIMIZACIÓN: Warehouse orphan purge desactivado para reducir lecturas
                    // const existingWarehousesSnap = await getDocs(warehousesCol);
                }

                // Save deliveryEvents + wipe orphans
                if (Array.isArray(this.data.deliveryEvents)) {
                    const eventsCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'deliveryEvents');
                    const localEventIds = new Set();
                    for (const event of this.data.deliveryEvents.slice(-500)) {
                        const eventId = String(event?.id || `${event.deliveryId || 'delivery'}_${event.changedAt || event.createdAt || Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
                        if (eventId) {
                            localEventIds.add(eventId);
                            batch.set(doc(eventsCol, eventId), this.removeUndefinedValues({
                                ...event,
                                id: eventId,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(eventsCol, localEventIds, 'deliveryEvents');
                }

                // Save promotions + wipe orphans
                if (Array.isArray(this.data.promotions)) {
                    const promotionsCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'promotions');
                    const localPromotionIds = new Set();
                    for (const promo of this.data.promotions) {
                        if (promo?.id) {
                            localPromotionIds.add(promo.id);
                            batch.set(doc(promotionsCol, promo.id), this.removeUndefinedValues({
                                ...promo,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(promotionsCol, localPromotionIds, 'promotions');
                }

                // Save warehouseStock + wipe orphans
                if (Array.isArray(this.data.warehouseStock)) {
                    const stockCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'warehouseStock');
                    const localStockIds = new Set();
                    for (const stock of this.data.warehouseStock) {
                        if (stock?.id) {
                            localStockIds.add(stock.id);
                            batch.set(doc(stockCol, stock.id), this.removeUndefinedValues({
                                ...stock,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(stockCol, localStockIds, 'warehouseStock');
                }

                // Save inventoryMovements + wipe orphans
                if (Array.isArray(this.data.inventoryMovements)) {
                    const movementsCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'inventoryMovements');
                    const localMovementIds = new Set();
                    for (const movement of this.data.inventoryMovements.slice(-500)) {
                        if (movement?.id) {
                            localMovementIds.add(movement.id);
                            batch.set(doc(movementsCol, movement.id), this.removeUndefinedValues({
                                ...movement,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(movementsCol, localMovementIds, 'inventoryMovements');
                }

                // Save replenishmentAlerts + wipe orphans
                if (Array.isArray(this.data.replenishmentAlerts)) {
                    const alertsCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'replenishmentAlerts');
                    const localAlertIds = new Set();
                    for (const alert of this.data.replenishmentAlerts) {
                        if (alert?.id) {
                            localAlertIds.add(alert.id);
                            batch.set(doc(alertsCol, alert.id), this.removeUndefinedValues({
                                ...alert,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(alertsCol, localAlertIds, 'replenishmentAlerts');
                }

                // Save expiryPromotions + wipe orphans
                if (Array.isArray(this.data.expiryPromotions)) {
                    const expiryPromoCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'expiryPromotions');
                    const localExpiryPromoIds = new Set();
                    for (const promo of this.data.expiryPromotions) {
                        if (promo?.id) {
                            localExpiryPromoIds.add(promo.id);
                            batch.set(doc(expiryPromoCol, promo.id), this.removeUndefinedValues({
                                ...promo,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(expiryPromoCol, localExpiryPromoIds, 'expiryPromotions');
                }

                // Save demandForecasts + wipe orphans
                if (Array.isArray(this.data.demandForecasts)) {
                    const forecastCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'demandForecasts');
                    const localForecastIds = new Set();
                    for (const forecast of this.data.demandForecasts) {
                        if (forecast?.id) {
                            localForecastIds.add(forecast.id);
                            batch.set(doc(forecastCol, forecast.id), this.removeUndefinedValues({
                                ...forecast,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(forecastCol, localForecastIds, 'demandForecasts');
                }

                // Save audit + wipe orphans
                if (Array.isArray(this.data.audit)) {
                    const auditCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'audit');
                    const localAuditIds = new Set();
                    for (const entry of this.data.audit.slice(-100)) {
                        if (entry?.id) {
                            localAuditIds.add(entry.id);
                            batch.set(doc(auditCol, entry.id), this.removeUndefinedValues({
                                ...entry,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(auditCol, localAuditIds, 'audit');
                }

                // Save accountingAccounts + wipe orphans
                if (Array.isArray(this.data.accountingAccounts)) {
                    const accCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'accountingAccounts');
                    const localAccIds = new Set();
                    for (const acc of this.data.accountingAccounts) {
                        if (acc?.id) {
                            localAccIds.add(acc.id);
                            batch.set(doc(accCol, acc.id), this.removeUndefinedValues({
                                ...acc,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(accCol, localAccIds, 'accountingAccounts');
                }

                // Save accountingEntries + wipe orphans
                if (Array.isArray(this.data.accountingEntries)) {
                    const entriesCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'accountingEntries');
                    const localEntryIds = new Set();
                    for (const entry of this.data.accountingEntries) {
                        if (entry?.id) {
                            localEntryIds.add(entry.id);
                            batch.set(doc(entriesCol, entry.id), this.removeUndefinedValues({
                                ...entry,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(entriesCol, localEntryIds, 'accountingEntries');
                }

                // 8. Save taxes + wipe orphans
                if (Array.isArray(this.data.taxes)) {
                    const taxesCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'taxes');
                    const taxIds = new Set();
                    for (const tax of this.data.taxes) {
                        if (tax?.id) {
                            taxIds.add(tax.id);
                            batch.set(doc(taxesCol, tax.id), this.removeUndefinedValues({
                                ...tax,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    // OPTIMIZACIÓN: Tax orphan purge desactivado para reducir lecturas
                    // const existingTaxesSnap = await getDocs(taxesCol);
                }

                // Save posTerminals + wipe orphans
                if (Array.isArray(this.data.posTerminals)) {
                    const posTerminalsCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'posTerminals');
                    const posTerminalIds = new Set();
                    for (const pt of this.data.posTerminals) {
                        if (pt?.id) {
                            posTerminalIds.add(pt.id);
                            batch.set(doc(posTerminalsCol, pt.id), this.removeUndefinedValues({
                                ...pt,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(posTerminalsCol, posTerminalIds, 'posTerminals');
                }

                // Save posTerminalClosures + wipe orphans
                if (Array.isArray(this.data.posTerminalClosures)) {
                    const closuresCol = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, 'posTerminalClosures');
                    const closureIds = new Set();
                    for (const closure of this.data.posTerminalClosures.slice(-200)) {
                        if (closure?.id) {
                            closureIds.add(closure.id);
                            batch.set(doc(closuresCol, closure.id), this.removeUndefinedValues({
                                ...closure,
                                _syncedAt: Date.now()
                            }), { merge: true });
                        }
                    }
                    await wipeOrphans(closuresCol, closureIds, 'posTerminalClosures');
                }

                // Save CRM collections
                const crmCollections = ['loyaltyCards','walletTransactions','crmCoupons','crmCouponPurchases','reloadRequests','discountCampaigns','crmActivities'];
                for (const crmCol of crmCollections) {
                    if (Array.isArray(this.data[crmCol])) {
                        const crmRef = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, crmCol);
                        const crmIds = new Set();
                        const crmLimit = crmCol === 'crmActivities' ? 200 : (crmCol === 'walletTransactions' ? 500 : 300);
                        for (const item of this.data[crmCol].slice(-crmLimit)) {
                            if (item?.id) {
                                crmIds.add(item.id);
                                batch.set(doc(crmRef, item.id), this.removeUndefinedValues({ ...item, _syncedAt: Date.now() }), { merge: true });
                            }
                        }
                        await wipeOrphans(crmRef, crmIds, crmCol);
                    }
                }

                // Commit batch
                await batch.commit();
            }

            async forceCleanSync() {
                if (!this.cloud.tenantId) {
                    console.warn('[DataStore] forceCleanSync: no tenantId');
                    return;
                }
                console.log(`[DataStore] Iniciando limpieza forzada para tenant ${this.cloud.tenantId}`);
                // 1. Borrar localStorage segmentado de este tenant
                const collections = ['products','categories','clients','sales','suppliers','users','promotions','purchases','deliveries','deliveryEvents','audit','locales','warehouses','warehouseStock','containerReceipts','transfers','replenishmentAlerts','expiryPromotions','demandForecasts','accountingAccounts','accountingEntries','taxes'];
                collections.forEach(col => {
                    try {
                        localStorage.removeItem(this.getLocalStorageKey(col));
                    } catch (e) {}
                });
                // 2. Reiniciar datos en memoria
                this.data = this.createEmptyData();
                // 3. Recargar desde Supabase
                if (this._sbDataStore) {
                    await this._sbDataStore.syncAllTables(this.cloud.tenantId);
                    this._mergeRemoteData(this._sbDataStore);
                    this.ensureTaxesExist();
                    this.persistAllLocal();
                    this.notifyAll();
                    console.log('[DataStore] Limpieza forzada completada. Datos recargados desde Supabase.');
                } else {
                    console.warn('[DataStore] No hay conexión a Supabase. Usando datos locales vacíos.');
                }
            }

            async adminPurgeFirestoreCollection(collectionName, options = {}) {
                // Legacy Firestore purge no longer supported. Clear local data only.
                console.warn('[DataStore] adminPurgeFirestoreCollection is deprecated. Clearing local data only.');
                if (this.data[collectionName] !== undefined) {
                    this.data[collectionName] = [];
                    this.save(collectionName);
                    this.notify(collectionName);
                }
                return { success: true, deletedScope: 0, deletedTopLevel: 0 };
                const { alsoPurgeTopLevel = false, topLevelCollectionName = null } = options;
                // deliveries ya no es top-level; se ignora alsoPurgeTopLevel para deliveries
                if (!this.cloud.tenantId) {
                    console.warn('[DataStore] adminPurgeFirestoreCollection: no tenantId');
                    return { success: false, error: 'No tenantId' };
                }
                const scopeId = this.getCloudDataScopeId();
                const results = { deletedScope: 0, deletedTopLevel: 0 };

                // 1. Purgar subcolección del scope
                try {
                    const colRef = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, collectionName);
                    const snap = await getDocs(colRef);
                    let batch = writeBatch(db);
                    let count = 0;
                    for (const docSnap of snap.docs) {
                        batch.delete(doc(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, collectionName, docSnap.id));
                        count++;
                        if (count % 100 === 0) {
                            await batch.commit();
                            batch = writeBatch(db);
                        }
                    }
                    if (count % 100 !== 0) {
                        await batch.commit();
                    }
                    results.deletedScope = count;
                    console.log(`[DataStore] Purga completada: ${count} documentos eliminados de ${collectionName} en scope ${scopeId}`);
                } catch (e) {
                    console.warn(`[DataStore] Error purgando ${collectionName} en scope:`, e);
                    results.scopeError = e.message;
                }

                // 2. Purgar colección de nivel superior si aplica (legacy, deliveries ya no aplica)
                if (alsoPurgeTopLevel && topLevelCollectionName && collectionName !== 'deliveries') {
                    try {
                        const colRef = collection(db, 'rw_tenants', this.cloud.tenantId, topLevelCollectionName);
                        const snap = await getDocs(colRef);
                        let batch = writeBatch(db);
                        let count = 0;
                        for (const docSnap of snap.docs) {
                            batch.delete(doc(db, 'rw_tenants', this.cloud.tenantId, topLevelCollectionName, docSnap.id));
                            count++;
                            if (count % 100 === 0) {
                                await batch.commit();
                                batch = writeBatch(db);
                            }
                        }
                        if (count % 100 !== 0) {
                            await batch.commit();
                        }
                        results.deletedTopLevel = count;
                        console.log(`[DataStore] Purga completada: ${count} documentos eliminados de ${topLevelCollectionName} (top-level)`);
                    } catch (e) {
                        console.warn(`[DataStore] Error purgando ${topLevelCollectionName} top-level:`, e);
                        results.topLevelError = e.message;
                    }
                }

                // 3. Limpiar local
                if (this.data[collectionName] !== undefined) {
                    this.data[collectionName] = [];
                    this.save(collectionName);
                    this.notify(collectionName);
                }

                return { success: true, ...results };
            }

            // NEW: Load data from subcollections
            async loadFromSubcollections() {
                if (!this.cloud.enabled || !this.cloud.userId || !this.cloud.tenantId) return null;
                
                // COOLDOWN: Evitar recargas innecesarias si la última fue hace poco (< 30s)
                const now = Date.now();
                if (this._lastSubcollectionLoadTime && (now - this._lastSubcollectionLoadTime < 30000)) {
                    console.log('[DataStore] loadFromSubcollections skipped (cooldown: < 30s since last load)');
                    return this._lastSubcollectionData;
                }
                
                // Prevenir cargas simultáneas que puedan causar quota exceeded
                if (this._loadingSubcollections) {
                    console.log('[DataStore] loadFromSubcollections already in progress, waiting...');
                    await new Promise(resolve => {
                        const check = () => {
                            if (!this._loadingSubcollections) resolve();
                            else setTimeout(check, 100);
                        };
                        check();
                    });
                    return this._lastSubcollectionData;
                }
                
                this._loadingSubcollections = true;
                this._lastSubcollectionLoadTime = Date.now();
                const startTime = Date.now();
                
                try {

                const sharedScopeId = this.getCloudDataScopeId();
                const hasCloudData = (payload) => {
                    if (!payload || typeof payload !== 'object') return false;
                    const collections = ['products', 'clients', 'sales', 'quotes', 'trainingResults', 'suppliers', 'categories', 'warehouses', 'taxes', 'users', 'deliveries', 'deliveryEvents', 'warehouseStock', 'inventoryMovements', 'purchases', 'promotions', 'audit', 'locales', 'transfers', 'replenishmentAlerts', 'expiryPromotions', 'demandForecasts', 'accountingAccounts', 'accountingEntries', 'posTerminals', 'posTerminalClosures', 'loyaltyCards', 'walletTransactions', 'crmCoupons', 'crmCouponPurchases', 'reloadRequests', 'discountCampaigns', 'crmActivities'];
                    return collections.some((key) => Array.isArray(payload[key]) && payload[key].length > 0) ||
                        Object.keys(payload.settings || {}).length > 0 ||
                        Object.keys(payload.accountingConfigs || {}).length > 0 ||
                        !!(payload.cashRegister && typeof payload.cashRegister === 'object' && Array.isArray(payload.cashRegister.movements));
                };
                const preferNonEmptyArray = (primary, fallback) => {
                    if (Array.isArray(primary) && primary.length > 0) return primary;
                    return Array.isArray(fallback) ? fallback : [];
                };

                const loadScope = async (scopeId) => {
                    console.log(`Loading from subcollections (${scopeId})...`);
                    const userRef = doc(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId);
                    
                    // Load settings and any legacy storeData snapshot
                    const userSnap = await getDoc(userRef);
                    const settings = userSnap.exists() ? userSnap.data() : {};
                    const legacyStoreData = settings.storeData && typeof settings.storeData === 'object' ? settings.storeData : {};

                    // Configuración de límites para optimizar lecturas (evitar quota exceeded)
                    // Datos maestros: todos los registros (usualmente pocos)
                    // Datos transaccionales: solo los últimos N registros
                    // OPTIMIZACIÓN: Límites reducidos para minimizar lecturas diarias
                    const LIMITS = {
                        products: 500,         // Catálogo
                        clients: 300,          // Clientes activos
                        users: 50,             // Usuarios del sistema
                        suppliers: 200,        // Proveedores
                        categories: 50,        // Categorías
                        locales: 20,          // Locales/sucursales
                        warehouses: 20,        // Almacenes
                        taxes: 20,             // Impuestos
                        sales: 200,            // Últimas 200 ventas
                        deliveries: 100,       // Últimas 100 entregas
                        deliveryEvents: 200,   // Últimos 200 eventos
                        purchases: 100,        // Últimas 100 compras
                        containerReceipts: 60, // Últimas 60 recepciones
                        transfers: 50,         // Últimas 50 transferencias
                        audit: 50,             // Últimos 50 registros de auditoría
                        warehouseStock: 500,   // Stock actual
                        inventoryMovements: 200, // Últimos 200 movimientos
                        trainingResults: 100,   // Últimos 100 resultados
                        promotions: 30,         // Promociones activas
                        quotes: 50,             // Últimas 50 cotizaciones
                        replenishmentAlerts: 50, // Alertas
                        expiryPromotions: 50,   // Promociones por caducidad
                        demandForecasts: 50,    // Pronósticos
                        accountingAccounts: 100, // Cuentas contables
                        accountingEntries: 100,  // Últimos 100 asientos
                        posTerminals: 20,        // Puntos de venta
                        posTerminalClosures: 100,  // Últimos 100 cierres
                        loyaltyCards: 300,
                        walletTransactions: 500,
                        crmCoupons: 100,
                        crmCouponPurchases: 300,
                        reloadRequests: 200,
                        discountCampaigns: 100,
                        crmActivities: 200
                    };

                    // Helper para cargar colección con límite
                    const belongsToTenant = (item) => {
                        const itemTenant = String(item?.tenantId || '').trim();
                        if (!itemTenant) {
                            console.warn(`[loadScope] Ignorando registro sin tenantId en scope ${scopeId}:`, item?.id || item?.deliveryId || 'unknown');
                            return false;
                        }
                        return itemTenant === this.cloud.tenantId;
                    };

                    const loadCollection = async (colName, limitCount = null) => {
                        try {
                            const colRef = collection(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, colName);
                            // Si la colección es transaccional y soporta createdAt, ordenar por fecha.
                            const collectionsWithCreatedAt = new Set(['sales', 'deliveries', 'deliveryEvents', 'purchases', 'transfers', 'audit', 'trainingResults']);
                            const q = limitCount
                                ? (collectionsWithCreatedAt.has(colName)
                                    ? query(colRef, orderBy('createdAt', 'desc'), limit(limitCount))
                                    : query(colRef, limit(limitCount)))
                                : colRef;
                            const snap = await getDocs(q);
                            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
                        } catch (error) {
                            console.warn(`Error loading ${colName}:`, error.message);
                            if (limitCount) {
                                try {
                                    const fallbackSnap = await getDocs(query(colRef, limit(limitCount)));
                                    return fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                                } catch (fallbackError) {
                                    console.warn(`Fallback loading ${colName} sin orderBy también falló:`, fallbackError.message);
                                }
                            }
                            return [];
                        }
                    };

                    // Cargar datos maestros (sin límite o con límite alto)
                    const [products, categories, locales, warehouses, taxes, suppliers, warehouseStock] = await Promise.all([
                        loadCollection('products', LIMITS.products),
                        loadCollection('categories', LIMITS.categories),
                        loadCollection('locales', LIMITS.locales),
                        loadCollection('warehouses', LIMITS.warehouses),
                        loadCollection('taxes', LIMITS.taxes),
                        loadCollection('suppliers', LIMITS.suppliers),
                        loadCollection('warehouseStock', LIMITS.warehouseStock),
                    ]);

                    // Cargar datos operativos (clientes y usuarios)
                    const [clients, users] = await Promise.all([
                        loadCollection('clients', LIMITS.clients),
                        loadCollection('users', LIMITS.users),
                    ]);

                    // Cargar datos transaccionales (con límites para evitar quota exceeded)
                    const [sales, deliveries, deliveryEvents, purchases, containerReceipts, transfers, audit, trainingResults, inventoryMovements, promotions, quotes, replenishmentAlerts, expiryPromotions, demandForecasts, accountingAccounts, accountingEntries, posTerminals, posTerminalClosures] = await Promise.all([
                        loadCollection('sales', LIMITS.sales),
                        loadCollection('deliveries', LIMITS.deliveries),
                        loadCollection('deliveryEvents', LIMITS.deliveryEvents),
                        loadCollection('purchases', LIMITS.purchases),
                        loadCollection('containerReceipts', LIMITS.containerReceipts),
                        loadCollection('transfers', LIMITS.transfers),
                        loadCollection('audit', LIMITS.audit),
                        loadCollection('trainingResults', LIMITS.trainingResults),
                        loadCollection('inventoryMovements', LIMITS.inventoryMovements),
                        loadCollection('promotions', LIMITS.promotions),
                        loadCollection('quotes', LIMITS.quotes),
                        loadCollection('replenishmentAlerts', LIMITS.replenishmentAlerts),
                        loadCollection('expiryPromotions', LIMITS.expiryPromotions),
                        loadCollection('demandForecasts', LIMITS.demandForecasts),
                        loadCollection('accountingAccounts', LIMITS.accountingAccounts),
                        loadCollection('accountingEntries', LIMITS.accountingEntries),
                        loadCollection('posTerminals', LIMITS.posTerminals),
                        loadCollection('posTerminalClosures', LIMITS.posTerminalClosures),
                    ]);

                    // Cargar datos CRM
                    const [loyaltyCards, walletTransactions, crmCoupons, crmCouponPurchases, reloadRequests, discountCampaigns, crmActivities] = await Promise.all([
                        loadCollection('loyaltyCards', LIMITS.loyaltyCards),
                        loadCollection('walletTransactions', LIMITS.walletTransactions),
                        loadCollection('crmCoupons', LIMITS.crmCoupons),
                        loadCollection('crmCouponPurchases', LIMITS.crmCouponPurchases),
                        loadCollection('reloadRequests', LIMITS.reloadRequests),
                        loadCollection('discountCampaigns', LIMITS.discountCampaigns),
                        loadCollection('crmActivities', LIMITS.crmActivities),
                    ]);

                    // Invertir orden para que queden cronológicos (más recientes al final)
                    const salesAsc = sales.reverse();
                    const deliveriesAsc = deliveries.reverse();
                    const deliveryEventsAsc = deliveryEvents.reverse();
                    const trainingResultsAsc = trainingResults.reverse();

                    // Filtrar datos demo heredados de la nube
                    const demoProductIds = new Set(['prod1','prod2','prod3','prod4','prod5','prod6','prod7','prod8','prod9']);
                    const demoPromotionIds = new Set(['promo1','promo2']);
                    const demoClientIds = new Set(['client_1','client_2','client_3']);
                    const demoSaleIds = new Set(['sale_1','sale_2']);
                    const demoDeliveryIds = new Set(['delivery_1']);

                    const filteredProducts = (products || []).filter(p => !demoProductIds.has(p?.id));
                    const filteredPromotions = (promotions || []).filter(p => !demoPromotionIds.has(p?.id));
                    const filteredClients = (clients || []).filter(c => !demoClientIds.has(c?.id));
                    const filteredSales = (salesAsc || []).filter((s) => {
                        if (!belongsToTenant(s)) return false;
                        return !demoSaleIds.has(s?.id);
                    });
                    const filteredDeliveries = (deliveriesAsc || []).filter((d) => {
                        if (!belongsToTenant(d)) {
                            console.warn(`[loadScope] Excluyendo entrega no perteneciente a tenant ${this.cloud.tenantId}:`, d?.id, d?.tenantId);
                            return false;
                        }
                        return !demoDeliveryIds.has(d?.id);
                    });
                    const allowedDeliveryIds = new Set(filteredDeliveries.map((d) => d.id));
                    const filteredDeliveryEvents = (deliveryEventsAsc || []).filter((e) => {
                        if (!belongsToTenant(e)) return false;
                        if (e?.deliveryId && !allowedDeliveryIds.has(e.deliveryId)) return false;
                        const note = String(e?.note || '').toLowerCase();
                        return e?.deliveryId !== 'delivery_1' && e?.trackingCode !== 'TRKDEMO001' && !note.includes('demo');
                    });
                    const filteredLegacyDeliveries = (legacyStoreData.deliveries || []).filter((d) => {
                        if (!belongsToTenant(d)) {
                            return false;
                        }
                        return !demoDeliveryIds.has(d?.id);
                    });
                    const filteredLegacyDeliveryEvents = (legacyStoreData.deliveryEvents || []).filter((e) => {
                        if (e?.tenantId && e.tenantId !== this.cloud.tenantId) return false;
                        if (e?.deliveryId && !allowedDeliveryIds.has(e.deliveryId)) return false;
                        const note = String(e?.note || '').toLowerCase();
                        return e?.deliveryId !== 'delivery_1' && e?.trackingCode !== 'TRKDEMO001' && !note.includes('demo');
                    });

                    // OPTIMIZACIÓN: Eliminación de documentos demo desactivada para reducir escrituras
                    // const demoDocsToDelete = [];
                    // (products || []).forEach(p => { if (demoProductIds.has(p?.id)) demoDocsToDelete.push({ col: 'products', id: p.id }); });
                    // ...

                    const mergedPayload = {
                        settings: Object.keys(settings.settings || {}).length > 0 ? settings.settings : (legacyStoreData.settings || {}),
                        // cashRegister es estado local del dispositivo; no se carga desde la nube
                        accountingConfigs: settings.accountingConfigs || legacyStoreData.accountingConfigs || {},
                        products: preferNonEmptyArray(filteredProducts, (legacyStoreData.products || []).filter(p => !demoProductIds.has(p?.id))),
                        clients: preferNonEmptyArray(filteredClients, (legacyStoreData.clients || []).filter(c => !demoClientIds.has(c?.id))),
                        users: preferNonEmptyArray(users, legacyStoreData.users),
                        deliveries: preferNonEmptyArray(filteredDeliveries, filteredLegacyDeliveries),
                        deliveryEvents: preferNonEmptyArray(filteredDeliveryEvents, filteredLegacyDeliveryEvents),
                        sales: preferNonEmptyArray(filteredSales, (legacyStoreData.sales || []).filter((s) => {
                            if (!belongsToTenant(s)) return false;
                            return !demoSaleIds.has(s?.id);
                        })),
                        quotes: preferNonEmptyArray(quotes, legacyStoreData.quotes),
                        trainingResults: preferNonEmptyArray(trainingResultsAsc, legacyStoreData.trainingResults),
                        suppliers: preferNonEmptyArray(suppliers, legacyStoreData.suppliers),
                        categories: preferNonEmptyArray(categories, legacyStoreData.categories),
                        locales: preferNonEmptyArray(locales, legacyStoreData.locales),
                        warehouses: preferNonEmptyArray(warehouses, legacyStoreData.warehouses),
                        taxes: preferNonEmptyArray(taxes, legacyStoreData.taxes),
                        warehouseStock: preferNonEmptyArray(warehouseStock, legacyStoreData.warehouseStock),
                        purchases: preferNonEmptyArray(purchases, legacyStoreData.purchases),
                        containerReceipts: preferNonEmptyArray(containerReceipts, legacyStoreData.containerReceipts),
                        promotions: preferNonEmptyArray(filteredPromotions, legacyStoreData.promotions),
                        audit: preferNonEmptyArray(audit, legacyStoreData.audit),
                        transfers: preferNonEmptyArray(transfers, legacyStoreData.transfers),
                        replenishmentAlerts: preferNonEmptyArray(replenishmentAlerts, legacyStoreData.replenishmentAlerts),
                        expiryPromotions: preferNonEmptyArray(expiryPromotions, legacyStoreData.expiryPromotions),
                        demandForecasts: preferNonEmptyArray(demandForecasts, legacyStoreData.demandForecasts),
                        accountingAccounts: preferNonEmptyArray(accountingAccounts, legacyStoreData.accountingAccounts),
                        accountingEntries: preferNonEmptyArray(accountingEntries, legacyStoreData.accountingEntries),
                        inventoryMovements: preferNonEmptyArray(inventoryMovements, legacyStoreData.inventoryMovements),
                        posTerminals: preferNonEmptyArray(posTerminals, legacyStoreData.posTerminals),
                        posTerminalClosures: preferNonEmptyArray(posTerminalClosures, legacyStoreData.posTerminalClosures),
                        loyaltyCards: preferNonEmptyArray(loyaltyCards, legacyStoreData.loyaltyCards),
                        walletTransactions: preferNonEmptyArray(walletTransactions, legacyStoreData.walletTransactions),
                        crmCoupons: preferNonEmptyArray(crmCoupons, legacyStoreData.crmCoupons),
                        crmCouponPurchases: preferNonEmptyArray(crmCouponPurchases, legacyStoreData.crmCouponPurchases),
                        reloadRequests: preferNonEmptyArray(reloadRequests, legacyStoreData.reloadRequests),
                        discountCampaigns: preferNonEmptyArray(discountCampaigns, legacyStoreData.discountCampaigns),
                        crmActivities: preferNonEmptyArray(crmActivities, legacyStoreData.crmActivities),
                        cashRegisterStates: settings.cashRegisterStates || {},
                        _cloudMeta: {
                            loadedAt: Date.now(),
                            source: 'subcollections',
                            scopeId,
                            hasLegacyStoreData: Object.keys(legacyStoreData).length > 0,
                            needsSharedMigration: scopeId !== sharedScopeId || Object.keys(legacyStoreData).length > 0
                        }
                    };

                    const sampleSaleIds = mergedPayload.sales.slice(0, 5).map(s => s.id).join(', ');
                    console.log(`[DataStore] Loaded from cloud (${scopeId}): ${mergedPayload.products.length} products, ${mergedPayload.clients.length} clients, ${mergedPayload.sales.length} sales, ${mergedPayload.users.length} users, ${mergedPayload.deliveries.length} deliveries`);
                    if (mergedPayload.sales.length > 0) {
                        console.log(`[DataStore] Sample sales IDs from scope ${scopeId}: ${sampleSaleIds}`);
                    }
                    return mergedPayload;
                };

                const sharedData = await loadScope(sharedScopeId);

                const hasCoreData = (payload) => {
                    return Array.isArray(payload?.products) && payload.products.length > 0 ||
                        Array.isArray(payload?.clients) && payload.clients.length > 0 ||
                        Array.isArray(payload?.users) && payload.users.length > 0 ||
                        Array.isArray(payload?.categories) && payload.categories.length > 0;
                };

                if (!hasCoreData(sharedData) && this.cloud.userId && this.cloud.userId !== sharedScopeId) {
                    console.log(`[DataStore] Shared scope ${sharedScopeId} no contiene datos maestros. Intentando fallback con user scope ${this.cloud.userId}...`);
                    const fallbackData = await loadScope(this.cloud.userId);
                    if (hasCoreData(fallbackData) || fallbackData.sales.length > 0 || fallbackData.deliveries.length > 0) {
                        console.log('[DataStore] Se cargaron datos desde el scope alternativo del usuario.');
                        this._lastSubcollectionData = fallbackData;
                        return fallbackData;
                    }
                }

                // IMPORTANTE: Ya no se carga ni mergea el legacy scope del usuario.
                // Esto evita la contaminación cruzada entre tenants y la recreación
                // constante de documentos desde scopes antiguos.
                this._lastSubcollectionData = sharedData;
                return sharedData;
                
                } catch (error) {
                    console.error('[DataStore] Error loading from subcollections:', error);
                    // Si hay error de quota, retornar datos locales para no bloquear la app
                    if (error.code === 'resource-exhausted') {
                        console.warn('[DataStore] Quota exceeded - using local data');
                        ui?.showToast?.('Usando datos locales - límite de Firebase alcanzado', 'warning');
                    }
                    throw error;
                } finally {
                    this._loadingSubcollections = false;
                    console.log(`[DataStore] loadFromSubcollections completed in ${Date.now() - startTime}ms`);
                }
            }

            // Archive old data automatically (local trim only; Supabase handles long-term storage)
            async archiveOldData() {
                const ARCHIVE_AGE_DAYS = 90;
                const archiveCutoff = Date.now() - (ARCHIVE_AGE_DAYS * 24 * 60 * 60 * 1000);
                let archivedCount = 0;
                if (Array.isArray(this.data.sales)) {
                    const oldSales = this.data.sales.filter(s => (s.date || s.createdAt) < archiveCutoff);
                    archivedCount = oldSales.length;
                    const recentCount = this.data.sales.filter(s => (s.date || s.createdAt) >= archiveCutoff).length;
                    if (this.data.sales.length > recentCount + 100) {
                        this.data.sales = this.data.sales.slice(-Math.max(recentCount, 500));
                        this.save('sales');
                        console.log(`[DataStore] Trimmed sales to last ${this.data.sales.length} records`);
                    }
                }
                return archivedCount;
            }

            notifyAll() {
                Object.keys(this.listeners).forEach(collection => this.notify(collection));
            }
            
            initSampleData(options = {}) {
                const { includeExamples = false } = options;

                // Mantener la estructura base limpia para negocios reales.
                if (!Array.isArray(this.data.promotions)) this.data.promotions = [];
                if (includeExamples && this.data.promotions.length === 0) {
                    this.data.promotions = [
                        { id: 'promo1', name: '2x1 en Arroz', description: 'Todos los jueves', type: '2x1', value: 0, productId: 'prod1', category: 'Alimentos', days: [4], startDate: null, endDate: null, active: true },
                        { id: 'promo2', name: '10% en Combos', description: 'Descuento en combos', type: 'percent', value: 10, productId: null, category: null, days: [], startDate: null, endDate: null, active: true }
                    ];
                }

                if (!this.data.purchases) this.data.purchases = [];

                if (!this.data.warehouses || this.data.warehouses.length === 0) {
                    this.data.warehouses = [
                        { id: 'wh_general', name: 'Almacen General', type: 'general', location: 'Principal', isDefault: true, createdAt: Date.now() },
                        { id: 'wh_tienda', name: 'Tienda - Venta Directa', type: 'store', location: 'Punto de Venta', isDefault: false, minStockAlert: 10, createdAt: Date.now() }
                    ];
                }
                if (!this.data.warehouseStock) this.data.warehouseStock = [];
                if (!this.data.transfers) this.data.transfers = [];
                if (!this.data.replenishmentAlerts) this.data.replenishmentAlerts = [];
                if (!this.data.expiryPromotions) this.data.expiryPromotions = [];
                if (!this.data.demandForecasts) this.data.demandForecasts = [];
                
                // Inicializar tipos de impuestos por defecto
                if (!this.data.taxes || this.data.taxes.length === 0) {
                    this.data.taxes = [
                        { id: 'tax_iva_15', name: 'IVA 15%', rate: 15, isDefault: true, active: true, description: 'Impuesto al Valor Agregado - Tasa General', createdAt: Date.now() },
                        { id: 'tax_iva_0', name: 'IVA 0% (Exento)', rate: 0, isDefault: false, active: true, description: 'Productos exentos de IVA', createdAt: Date.now() },
                        { id: 'tax_iva_5', name: 'IVA 5%', rate: 5, isDefault: false, active: true, description: 'IVA Reducido', createdAt: Date.now() }
                    ];
                    this.save('taxes');
                }

                if (includeExamples && this.data.products.length === 0) {
                    const defaultTaxId = this.getDefaultTax().id;
                    const exemptTaxId = this.data.taxes.find(t => t.rate === 0)?.id || defaultTaxId;
                    
                    this.data.products = [
                        { id: 'prod1', name: 'Arroz 5kg', sku: 'SKU-001', category: 'Alimentos', taxId: defaultTaxId, price: 8500, cost: 6000, stock: 120, minStock: 20, active: true, hasVariants: false, hasExpiry: true, lotNumber: 'LOT-001', expiryDate: '2026-12-31', image: null, createdAt: Date.now() },
                        { id: 'prod2', name: 'Aceite 1L', sku: 'SKU-002', category: 'Alimentos', taxId: defaultTaxId, price: 5200, cost: 3500, stock: 85, minStock: 15, active: true, hasVariants: false, hasExpiry: false, image: null, createdAt: Date.now() },
                        { id: 'prod3', name: 'Detergente', sku: 'SKU-003', category: 'Limpieza', taxId: exemptTaxId, price: 3500, cost: 2200, stock: 200, minStock: 30, active: true, hasVariants: false, hasExpiry: false, image: null, createdAt: Date.now() },
                        { id: 'prod4', name: 'Leche en Polvo', sku: 'SKU-004', category: 'Lácteos', taxId: defaultTaxId, price: 7500, cost: 5000, stock: 60, minStock: 10, active: true, hasVariants: false, hasExpiry: true, lotNumber: 'LOT-002', expiryDate: '2026-06-30', image: null, createdAt: Date.now() },
                        { id: 'prod5', name: 'Sardinas en Lata', sku: 'SKU-005', category: 'Conservas', taxId: defaultTaxId, price: 4800, cost: 3000, stock: 95, minStock: 15, active: true, hasVariants: false, hasExpiry: true, lotNumber: 'LOT-003', expiryDate: '2026-08-15', image: null, createdAt: Date.now() },
                        { id: 'prod6', name: 'Fideos 500g', sku: 'SKU-006', category: 'Alimentos', taxId: defaultTaxId, price: 2800, cost: 1800, stock: 150, minStock: 20, active: true, hasVariants: false, hasExpiry: true, lotNumber: 'LOT-004', expiryDate: '2026-09-20', image: null, createdAt: Date.now() },
                        { id: 'prod7', name: 'Jabón de Baño', sku: 'SKU-007', category: 'Limpieza', taxId: defaultTaxId, price: 2200, cost: 1400, stock: 110, minStock: 20, active: true, hasVariants: false, hasExpiry: true, lotNumber: 'LOT-005', expiryDate: '2026-11-30', image: null, createdAt: Date.now() },
                        { id: 'prod8', name: 'Harina de Trigo 1kg', sku: 'SKU-008', category: 'Alimentos', taxId: defaultTaxId, price: 3200, cost: 2100, stock: 80, minStock: 15, active: true, hasVariants: false, hasExpiry: false, image: null, createdAt: Date.now() },
                        { id: 'prod9', name: 'Cerveza Importada', sku: 'SKU-009', category: 'Bebidas', taxId: defaultTaxId, price: 15000, cost: 9500, stock: 55, minStock: 10, active: true, hasVariants: true, hasExpiry: false, sizes: ['33cl','50cl','1L'], colors: ['Rubia','Negra'], variants: [{key:'33cl-Rubia',stock:15,sku:'SKU-009-33-R'},{key:'33cl-Negra',stock:10,sku:'SKU-009-33-N'},{key:'50cl-Rubia',stock:12,sku:'SKU-009-50-R'},{key:'50cl-Negra',stock:8,sku:'SKU-009-50-N'},{key:'1L-Rubia',stock:6,sku:'SKU-009-1L-R'},{key:'1L-Negra',stock:4,sku:'SKU-009-1L-N'}], image: null, createdAt: Date.now() }
                    ];
                    this.save('products');
                }

                if (includeExamples) {
                    if (this.data.clients.length === 0) this.save('clients');
                    if (this.data.sales.length === 0) this.save('sales');
                }
            }

            seedDemoData() {
                if (!AppState.demoMode) return;
                this.initSampleData({ includeExamples: true });

                // Solo cargar datos de demo si no hay datos existentes para no duplicar.
                if (this.data.clients.length === 0) {
                    const demoClients = [
                        { id: 'client_1', firstName: 'Cliente', lastName: 'Ocasional', phone: '+240 222 111 222', email: '', taxId: '', address: 'Malabo', credit: 0, purchases: 5, createdAt: Date.now() },
                        { id: 'client_2', firstName: 'María', lastName: 'Ndong', phone: '+240 222 333 444', email: 'maria.ndong@demo.com', taxId: 'GE123456', address: 'Bata', credit: 25000, purchases: 8, createdAt: Date.now() },
                        { id: 'client_3', firstName: 'Pedro', lastName: 'Ebang', phone: '+240 222 555 666', email: 'pedro.ebang@demo.com', taxId: 'GE654321', address: 'Malabo', credit: 0, purchases: 3, createdAt: Date.now() }
                    ];
                    demoClients.forEach(client => this.add('clients', client));
                }

                if (this.data.sales.length === 0) {
                    const now = new Date();
                    const demoSales = [
                        {
                            id: 'sale_1',
                            ticket: 1001,
                            clientId: 'client_1',
                            clientName: 'Cliente Ocasional',
                            items: [{ id: 'prod1', name: 'Arroz 5kg', price: 8500, qty: 2 }, { id: 'prod2', name: 'Aceite 1L', price: 5200, qty: 1 }],
                            subtotal: 22200,
                            discount: 0,
                            tax: 3330,
                            total: 25530,
                            paymentMethod: 'cash',
                            status: 'completed',
                            paid: 25530,
                            balance: 0,
                            date: new Date(now.getTime() - 86400000).toISOString(),
                            createdAt: Date.now()
                        },
                        {
                            id: 'sale_2',
                            ticket: 1002,
                            clientId: 'client_2',
                            clientName: 'María Ndong',
                            items: [{ id: 'prod9', name: 'Cerveza Importada', price: 15000, qty: 3 }, { id: 'prod3', name: 'Detergente', price: 3500, qty: 2 }],
                            subtotal: 52000,
                            discount: 5200,
                            tax: 7020,
                            total: 53820,
                            paymentMethod: 'credit',
                            status: 'credit',
                            paid: 0,
                            balance: 53820,
                            date: new Date(now.getTime() - 3600000).toISOString(),
                            createdAt: Date.now()
                        }
                    ];
                    demoSales.forEach(sale => this.add('sales', sale));
                }

                if (this.data.deliveries.length === 0) {
                    const demoDelivery = {
                        id: 'delivery_1',
                        saleId: 'sale_1',
                        ticket: 1001,
                        clientId: 'client_1',
                        clientName: 'Cliente Ocasional',
                        clientPhone: '+240 222 111 222',
                        address: 'Malabo',
                        notes: 'Entregar entre 9am y 11am',
                        scheduledAt: new Date(new Date().getTime() + 86400000).toISOString(),
                        status: 'programada',
                        trackingCode: 'TRKDEMO001',
                        history: [{ status: 'programada', note: 'Programada en demo', at: new Date().toISOString() }],
                        tenantId: this.cloud.tenantId || 'demo',
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    };
                    this.add('deliveries', demoDelivery);
                    this.add('deliveryEvents', { deliveryId: demoDelivery.id, trackingCode: demoDelivery.trackingCode, status: demoDelivery.status, note: 'Creada demo', changedBy: AppState.user?.email || 'demo@riverwall.com', changedAt: new Date().toISOString() });
                }

                // Generar entradas de auditoría de ejemplo si el audit está vacío
                if (!Array.isArray(this.data.audit) || this.data.audit.length === 0) {
                    const now = Date.now();
                    this.data.audit = [
                        { id: 'audit_' + now, action: 'LOGIN', collection: 'users', itemId: 'demo-user-id', userId: 'demo', userName: 'Usuario Demo', timestamp: now - 86400000 },
                        { id: 'audit_' + (now + 1), action: 'CREATE', collection: 'products', itemId: 'prod1', details: { name: 'Arroz 5kg' }, userId: 'demo', userName: 'Usuario Demo', timestamp: now - 72000000 },
                        { id: 'audit_' + (now + 2), action: 'CREATE', collection: 'clients', itemId: 'client_1', details: { name: 'Cliente Ocasional' }, userId: 'demo', userName: 'Usuario Demo', timestamp: now - 36000000 },
                        { id: 'audit_' + (now + 3), action: 'SALE', collection: 'sales', itemId: 'sale_1', details: { name: 'Venta #1001' }, userId: 'demo', userName: 'Usuario Demo', timestamp: now - 18000000 },
                        { id: 'audit_' + (now + 4), action: 'UPDATE', collection: 'products', itemId: 'prod2', details: { name: 'Aceite 1L' }, userId: 'demo', userName: 'Usuario Demo', timestamp: now - 3600000 }
                    ];
                    this.save('audit');
                }
            }

            removeDemoArtifacts() {
                if (AppState.demoMode) return false;

                const demoIds = {
                    products: new Set(['prod1','prod2','prod3','prod4','prod5','prod6','prod7','prod8','prod9']),
                    promotions: new Set(['promo1','promo2']),
                    clients: new Set(['client_1','client_2','client_3']),
                    sales: new Set(['sale_1','sale_2']),
                    deliveries: new Set(['delivery_1'])
                };

                let changed = false;
                const removeByIds = (collection, ids) => {
                    if (!Array.isArray(this.data[collection]) || this.data[collection].length === 0) return;
                    const nextItems = this.data[collection].filter(item => !ids.has(item?.id));
                    if (nextItems.length !== this.data[collection].length) {
                        this.data[collection] = nextItems;
                        this.save(collection);
                        this.notify(collection);
                        changed = true;
                    }
                };

                Object.entries(demoIds).forEach(([collection, ids]) => removeByIds(collection, ids));

                if (Array.isArray(this.data.deliveryEvents) && this.data.deliveryEvents.length > 0) {
                    const nextEvents = this.data.deliveryEvents.filter(event => {
                        const note = String(event?.note || '').toLowerCase();
                        return event?.deliveryId !== 'delivery_1' && event?.trackingCode !== 'TRKDEMO001' && !note.includes('demo');
                    });
                    if (nextEvents.length !== this.data.deliveryEvents.length) {
                        this.data.deliveryEvents = nextEvents;
                        this.save('deliveryEvents');
                        this.notify('deliveryEvents');
                        changed = true;
                    }
                }

                // También eliminar de Firestore para que no vuelvan a cargarse
                if (changed && this.cloud.enabled && this.cloud.tenantId) {
                    const scopeId = this.getCloudDataScopeId();
                    (async () => {
                        try {
                            const batch = writeBatch(db);
                            Object.entries(demoIds).forEach(([collection, ids]) => {
                                ids.forEach(id => {
                                    const ref = doc(db, 'rw_tenants', this.cloud.tenantId, 'users', scopeId, collection, id);
                                    batch.delete(ref);
                                });
                            });
                            await batch.commit();
                            console.log('[DataStore] Documentos demo eliminados de Firestore');
                        } catch (err) {
                            console.warn('[DataStore] No se pudieron eliminar documentos demo de Firestore:', err);
                        }
                    })();
                }

                return changed;
            }
            
            get(collection, options = {}) { 
                if (this.data[collection] === undefined || this.data[collection] === null) {
                    this.data[collection] = [];
                }
                const val = this.data[collection];
                let result = Array.isArray(val) ? [...val] : { ...val };
                
                // Auto-filter local-scoped collections by current localId unless allLocals requested
                const localScopedCollections = ['sales','deliveries','deliveryEvents','purchases','warehouses','warehouseStock','inventoryMovements','transfers','posTerminals','posTerminalClosures','cashMovements','containerReceipts','quotes','products','categories','clients','suppliers','taxes','promotions'];
                if (Array.isArray(result) && localScopedCollections.includes(collection) && !options.allLocals && AppState.currentLocalId) {
                    if (collection === 'transfers') {
                        result = result.filter(item => !item.fromLocalId || item.fromLocalId === AppState.currentLocalId || !item.toLocalId || item.toLocalId === AppState.currentLocalId);
                    } else {
                        result = result.filter(item => !item.localId || item.localId === AppState.currentLocalId);
                    }
                }
                
                return result;
            }

            getAll(collection) {
                return this.get(collection);
            }
            
            getById(collection, id, options = {}) {
                const item = this.data[collection].find(item => item.id === id);
                if (!item) return undefined;
                // Validate localId for local-scoped collections unless explicitly bypassed
                const localScopedCollections = ['sales','deliveries','deliveryEvents','purchases','warehouses','warehouseStock','inventoryMovements','transfers','posTerminals','posTerminalClosures','cashMovements','containerReceipts','quotes','products','categories','clients','suppliers','taxes','promotions'];
                if (!options.allLocals && localScopedCollections.includes(collection) && AppState.currentLocalId) {
                    if (collection === 'transfers') {
                        const isLocal = item.fromLocalId === AppState.currentLocalId || item.toLocalId === AppState.currentLocalId;
                        if (!isLocal) return undefined;
                    } else if (item.localId && item.localId !== AppState.currentLocalId) {
                        return undefined;
                    }
                }
                return item;
            }
            
            _generateUUID() {
                return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }

            _isUUID(str) {
                return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
            }

            _getSupabaseCollections() {
                return ['products','categories','clients','suppliers','warehouses','sales','purchases','locales','taxes','posTerminals'];
            }

            async _syncToSupabase(collection, operation, payload) {
                if (!this._sbDataStore || !this.cloud.tenantId || this.cloud.tenantId === 'default') return;
                if (AppState?.practicalExam) return;
                if (!this._getSupabaseCollections().includes(collection)) return;
                const tenantId = this.cloud.tenantId;
                try {
                    this._sbDataStore.setTenant(tenantId, this.cloud.userId);
                    this._sbDataStore.setLocale(AppState.currentLocalId);
                    if (collection === 'products') {
                        if (operation === 'delete') this._sbDataStore.deleteProduct(tenantId, payload).catch(() => {});
                        else this._sbDataStore.saveProduct(tenantId, payload).catch(() => {});
                    } else if (collection === 'clients') {
                        if (operation === 'delete') this._sbDataStore.delete('clients', payload, true).catch(() => {});
                        else this._sbDataStore.saveClient(tenantId, payload).catch(() => {});
                    } else if (collection === 'warehouses') {
                        if (operation === 'delete') this._sbDataStore.delete('warehouses', payload, true).catch(() => {});
                        else this._sbDataStore.saveWarehouse(tenantId, payload).catch(() => {});
                    } else if (collection === 'sales') {
                        if (operation === 'delete') this._sbDataStore.delete('sales', payload, true).catch(() => {});
                        else this._sbDataStore.saveSale(tenantId, payload).catch(() => {});
                    } else {
                        if (operation === 'insert') this._sbDataStore.insert(collection, payload, true).catch(() => {});
                        else if (operation === 'update') this._sbDataStore.update(collection, payload.id, payload, true).catch(() => {});
                        else if (operation === 'delete') this._sbDataStore.delete(collection, payload, true).catch(() => {});
                    }
                } catch (err) {
                    console.warn('[DataStore] Sync to Supabase failed:', err.message);
                }
            }

            add(collection, item) {
                const supabaseCollections = this._getSupabaseCollections();
                if (supabaseCollections.includes(collection)) {
                    item.id = item.id || this._generateUUID();
                } else {
                    item.id = item.id || collection + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                }
                item.createdAt = item.createdAt || Date.now();
                // Auto-tag local-scoped entities with current localId
                const localScopedCollections = ['sales','deliveries','deliveryEvents','purchases','warehouses','warehouseStock','inventoryMovements','posTerminals','posTerminalClosures','cashMovements','containerReceipts','quotes','products','categories','clients','suppliers','taxes','promotions'];
                if (localScopedCollections.includes(collection) && !item.localId && AppState.currentLocalId) {
                    item.localId = AppState.currentLocalId;
                }
                if (collection === 'transfers' && !item.fromLocalId && AppState.currentLocalId) {
                    item.fromLocalId = AppState.currentLocalId;
                }
                this.data[collection].push(item);
                this.save(collection);
                this.notify(collection);
                this.audit('CREATE', collection, item.id, item);
                this._syncToSupabase(collection, 'insert', item);
                return item;
            }
            
            update(collection, id, updates) {
                const index = this.data[collection].findIndex(item => item.id === id);
                if (index !== -1) {
                    const item = this.data[collection][index];
                    // Validate localId for local-scoped collections
                    const localScopedCollections = ['sales','deliveries','deliveryEvents','purchases','warehouses','warehouseStock','inventoryMovements','transfers','posTerminals','posTerminalClosures','cashMovements','containerReceipts','quotes','products','categories','clients','suppliers','taxes','promotions'];
                    if (localScopedCollections.includes(collection) && AppState.currentLocalId) {
                        if (collection === 'transfers') {
                            const isLocal = item.fromLocalId === AppState.currentLocalId || item.toLocalId === AppState.currentLocalId;
                            if (!isLocal) {
                                console.warn('[DataStore] update blocked: transfer does not belong to current local');
                                return null;
                            }
                        } else if (item.localId && item.localId !== AppState.currentLocalId) {
                            console.warn('[DataStore] update blocked: item does not belong to current local');
                            return null;
                        }
                    }
                    const oldData = { ...item };
                    this.data[collection][index] = { ...item, ...updates, updatedAt: Date.now() };
                    this.save(collection);
                    this.notify(collection);
                    this.audit('UPDATE', collection, id, { before: oldData, after: this.data[collection][index] });
                    this._syncToSupabase(collection, 'update', this.data[collection][index]);
                    return this.data[collection][index];
                }
                return null;
            }
            
            delete(collection, id) {
                const item = this.getById(collection, id, { allLocals: true });
                // Validate localId for local-scoped collections
                const localScopedCollections = ['sales','deliveries','deliveryEvents','purchases','warehouses','warehouseStock','inventoryMovements','transfers','posTerminals','posTerminalClosures','cashMovements','containerReceipts','quotes','products','categories','clients','suppliers','taxes','promotions'];
                if (item && localScopedCollections.includes(collection) && AppState.currentLocalId) {
                    if (collection === 'transfers') {
                        const isLocal = item.fromLocalId === AppState.currentLocalId || item.toLocalId === AppState.currentLocalId;
                        if (!isLocal) {
                            console.warn('[DataStore] delete blocked: transfer does not belong to current local');
                            return false;
                        }
                    } else if (item.localId && item.localId !== AppState.currentLocalId) {
                        console.warn('[DataStore] delete blocked: item does not belong to current local');
                        return false;
                    }
                }
                this.data[collection] = this.data[collection].filter(entry => entry.id !== id);
                this.save(collection);

                // Tombstone tracking to prevent zombie regeneration from cloud sync
                const tombstoneKey = this.getLocalStorageKey('_tombstones');
                let tombstones = {};
                try {
                    tombstones = JSON.parse(localStorage.getItem(tombstoneKey) || '{}');
                } catch(e) {}
                if (!tombstones[collection]) tombstones[collection] = {};
                tombstones[collection][id] = Date.now();
                // Clean tombstones older than 30 days to prevent unbounded growth
                const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
                const now = Date.now();
                for (const col of Object.keys(tombstones)) {
                    for (const key of Object.keys(tombstones[col])) {
                        if (now - tombstones[col][key] > THIRTY_DAYS) {
                            delete tombstones[col][key];
                        }
                    }
                }
                localStorage.setItem(tombstoneKey, JSON.stringify(tombstones));

                this._syncToSupabase(collection, 'delete', id);

                this.notify(collection);
                this.audit('DELETE', collection, id, item);
                return true;
            }
            
            save(collection) {
                try {
                    localStorage.setItem(this.getLocalStorageKey(collection), JSON.stringify(this.data[collection]));
                } catch (e) {
                    if (e.name === 'QuotaExceededError' || e.code === 22 || e.message?.includes('quota')) {
                        console.warn(`[DataStore] localStorage lleno al guardar '${collection}'. Limpiando audit...`);
                        if (collection !== 'audit' && this.data.audit && this.data.audit.length > 50) {
                            this.data.audit = this.data.audit.slice(0, 50);
                            try {
                                localStorage.setItem(this.getLocalStorageKey('audit'), JSON.stringify(this.data.audit));
                            } catch (e2) {
                                console.error('[DataStore] No se pudo limpiar audit:', e2);
                            }
                        }
                        try {
                            localStorage.setItem(this.getLocalStorageKey(collection), JSON.stringify(this.data[collection]));
                            console.log(`[DataStore] '${collection}' guardado tras limpiar audit.`);
                        } catch (e2) {
                            console.error(`[DataStore] Fallo crítico de almacenamiento para '${collection}':`, e2);
                            alert('El almacenamiento del navegador está lleno. Por favor, exporta tus datos y limpia el almacenamiento desde Ajustes → Avanzado.');
                        }
                    } else {
                        throw e;
                    }
                }
                this.scheduleCloudSave();
            }

            // Hook for cloud adapters (e.g. Supabase) to sync individual items.
            // Override in adapter to send collection/item to the cloud.
            _scheduleCloudSync(collection, item) {
                // no-op by default
            }
            
            subscribe(collection, callback) {
                if (!this.listeners[collection]) this.listeners[collection] = [];
                this.listeners[collection].push(callback);
                return () => {
                    this.listeners[collection] = this.listeners[collection].filter(cb => cb !== callback);
                };
            }
            
            notify(collection) {
                if (this.listeners[collection]) {
                    this.listeners[collection].forEach(cb => cb(this.data[collection]));
                }
            }
            
            audit(action, collection, itemId, details) {
                const auditEntry = {
                    id: 'audit_' + Date.now(),
                    action,
                    collection,
                    itemId,
                    details,
                    userId: AppState.user?.uid || 'demo',
                    userName: AppState.user?.displayName || AppState.user?.email || 'Demo User',
                    timestamp: Date.now()
                };
                this.data.audit.unshift(auditEntry);
                if (this.data.audit.length > 250) this.data.audit = this.data.audit.slice(0, 250);
                this.save('audit');
            }

            // ==================== LOCAL / BRANCH MANAGEMENT ====================
            getCurrentLocalId() {
                const tenantId = this.cloud?.tenantId || 'default';
                return localStorage.getItem(`rw_${tenantId}_currentLocalId`) || this.getDefaultLocalId();
            }

            setCurrentLocalId(id) {
                // Validate that the user has access to this local
                const accessibleIds = this.getUserAccessibleLocalIds();
                if (accessibleIds.size > 0 && !accessibleIds.has(id)) {
                    console.warn('[DataStore] setCurrentLocalId blocked: user does not have access to local', id);
                    return false;
                }
                const tenantId = this.cloud?.tenantId || 'default';
                localStorage.setItem(`rw_${tenantId}_currentLocalId`, id);
                AppState.currentLocalId = id;
                this.notify('locales');
                return true;
            }

            getDefaultLocalId() {
                // First try in-memory data
                const defaultLocal = this.data.locales?.find(l => l.isDefault && l.isActive !== false);
                if (defaultLocal) return defaultLocal.id;
                if (this.data.locales?.[0]?.id) return this.data.locales[0].id;
                // Fallback to localStorage
                try {
                    const savedLocales = JSON.parse(localStorage.getItem(this.getLocalStorageKey('locales')) || 'null');
                    if (Array.isArray(savedLocales) && savedLocales.length > 0) {
                        const savedDefault = savedLocales.find(l => l.isDefault && l.isActive !== false);
                        return savedDefault?.id || savedLocales[0]?.id || null;
                    }
                } catch (e) {}
                return null;
            }

            getLocalById(id) {
                return this.data.locales?.find(l => l.id === id);
            }

            getLocalLimit() {
                const plan = (licenseManager.getPlan() || 'starter').toLowerCase();
                return { starter: 1, pro: 3, enterprise: Infinity }[plan] || 1;
            }

            canCreateLocal() {
                const limit = this.getLocalLimit();
                const currentCount = this.data.locales?.filter(l => l.isActive !== false).length || 0;
                return limit === Infinity || currentCount < limit;
            }

            ensureDefaultLocal() {
                // Try to load existing locales from localStorage first (to avoid creating duplicates before cloud loads)
                if (!Array.isArray(this.data.locales) || this.data.locales.length === 0) {
                    try {
                        const savedLocales = JSON.parse(localStorage.getItem(this.getLocalStorageKey('locales')) || 'null');
                        if (Array.isArray(savedLocales) && savedLocales.length > 0) {
                            this.data.locales = savedLocales;
                            console.log('[DataStore] Locales cargados desde localStorage:', savedLocales.length);
                        }
                    } catch (e) {}
                }

                // Migración: si no hay locales, crear uno por defecto con los warehouses existentes
                if (!Array.isArray(this.data.locales) || this.data.locales.length === 0) {
                    const now = Date.now();
                    const defaultLocal = {
                        id: 'local_' + now,
                        name: this.data.settings?.businessName || 'Local Principal',
                        address: this.data.settings?.address || '',
                        phone: this.data.settings?.phone || '',
                        email: this.data.settings?.email || '',
                        isDefault: true,
                        isActive: true,
                        createdAt: now,
                        createdBy: 'system_migration'
                    };
                    this.data.locales = [defaultLocal];
                    this.save('locales');

                    // Asignar localId a warehouses existentes
                    if (Array.isArray(this.data.warehouses)) {
                        this.data.warehouses.forEach(wh => {
                            if (!wh.localId) wh.localId = defaultLocal.id;
                        });
                        this.save('warehouses');
                    }

                    // Asignar localId a datos operativos existentes
                    const assignLocal = (collection) => {
                        if (Array.isArray(this.data[collection])) {
                            this.data[collection].forEach(item => {
                                if (!item.localId) item.localId = defaultLocal.id;
                            });
                            this.save(collection);
                        }
                    };
                    assignLocal('sales');
                    assignLocal('deliveries');
                    assignLocal('purchases');
                    assignLocal('inventoryMovements');
                    assignLocal('posTerminals');
                    assignLocal('posTerminalClosures');
                    assignLocal('warehouseStock');
                    assignLocal('quotes');
                    
                    // Asignar localId a datos de catálogo existentes
                    assignLocal('products');
                    assignLocal('categories');
                    assignLocal('clients');
                    assignLocal('suppliers');
                    assignLocal('taxes');
                    assignLocal('promotions');
                    
                    // Asignar localId a transfers existentes
                    if (Array.isArray(this.data.transfers)) {
                        this.data.transfers.forEach(t => {
                            if (!t.fromLocalId) t.fromLocalId = defaultLocal.id;
                            if (!t.toLocalId) t.toLocalId = defaultLocal.id;
                        });
                        this.save('transfers');
                    }

                    console.log('[DataStore] Migración: local por defecto creado', defaultLocal.id);
                }
                this.ensureLocalScopedData();
                return this.getDefaultLocalId();
            }

            ensureLocalScopedData() {
                let defaultLocalId = this.getDefaultLocalId();
                if (!defaultLocalId) return;
                const validLocalIds = new Set((this.data.locales || []).map(l => l.id));
                let changed = false;

                // Detect auto-created "ghost" local and remove it if there are real user locales
                const ghostLocal = this.data.locales?.find(l => 
                    l.createdBy === 'system_migration' && 
                    l.isDefault && 
                    this.data.locales.length > 1
                );
                if (ghostLocal) {
                    console.log('[DataStore] Eliminando local fantasma:', ghostLocal.id);
                    this.data.locales = this.data.locales.filter(l => l.id !== ghostLocal.id);
                    // Reassign default flag to the first remaining local if none is default
                    if (!this.data.locales.some(l => l.isDefault)) {
                        this.data.locales[0].isDefault = true;
                    }
                    this.save('locales');
                    validLocalIds.delete(ghostLocal.id);
                    changed = true;
                    // Recalculate default local after removing ghost
                    defaultLocalId = this.getDefaultLocalId();
                }

                const assignLocalId = (collection) => {
                    if (!Array.isArray(this.data[collection])) return;
                    let collectionChanged = false;
                    this.data[collection].forEach(item => {
                        if (!item.localId || !validLocalIds.has(item.localId)) {
                            item.localId = defaultLocalId;
                            collectionChanged = true;
                        }
                    });
                    if (collectionChanged) {
                        changed = true;
                        this.save(collection);
                    }
                };

                // Operational collections
                assignLocalId('sales');
                assignLocalId('deliveries');
                assignLocalId('purchases');
                assignLocalId('inventoryMovements');
                assignLocalId('posTerminals');
                assignLocalId('posTerminalClosures');
                assignLocalId('warehouseStock');
                assignLocalId('quotes');
                assignLocalId('cashMovements');
                assignLocalId('containerReceipts');

                // Catalog collections
                assignLocalId('products');
                assignLocalId('categories');
                assignLocalId('clients');
                assignLocalId('suppliers');
                assignLocalId('taxes');
                assignLocalId('promotions');

                // Transfers
                if (Array.isArray(this.data.transfers)) {
                    this.data.transfers.forEach(t => {
                        if (!t.fromLocalId) { t.fromLocalId = defaultLocalId; changed = true; }
                        if (!t.toLocalId) { t.toLocalId = defaultLocalId; changed = true; }
                    });
                    if (changed) this.save('transfers');
                }

                if (changed) {
                    console.log('[DataStore] Migración: datos existentes asignados al local', defaultLocalId);
                }
            }

            copyCatalogToLocal(sourceLocalId, targetLocalId) {
                const generateId = (prefix) => prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                const now = Date.now();

                // Copy taxes
                const sourceTaxes = (this.data.taxes || []).filter(t => t.localId === sourceLocalId);
                const taxIdMap = {};
                sourceTaxes.forEach(tax => {
                    const newId = generateId('tax');
                    taxIdMap[tax.id] = newId;
                    this.data.taxes.push({ ...tax, id: newId, localId: targetLocalId, createdAt: now });
                });
                this.save('taxes');

                // Copy categories
                const sourceCategories = (this.data.categories || []).filter(c => c.localId === sourceLocalId);
                const catIdMap = {};
                sourceCategories.forEach(cat => {
                    const newId = generateId('cat');
                    catIdMap[cat.id] = newId;
                    this.data.categories.push({ ...cat, id: newId, localId: targetLocalId, createdAt: now });
                });
                this.save('categories');

                // Copy products
                const sourceProducts = (this.data.products || []).filter(p => p.localId === sourceLocalId);
                sourceProducts.forEach(prod => {
                    const newId = generateId('product');
                    const newTaxId = prod.taxId && taxIdMap[prod.taxId] ? taxIdMap[prod.taxId] : prod.taxId;
                    const copied = {
                        ...prod,
                        id: newId,
                        localId: targetLocalId,
                        taxId: newTaxId,
                        stock: 0,
                        image: (typeof prod.image === 'string' && prod.image.startsWith('data:')) ? null : prod.image,
                        createdAt: now
                    };
                    if (copied.variants) {
                        copied.variants = copied.variants.map(v => ({ ...v, stock: 0 }));
                    }
                    this.data.products.push(copied);
                });
                this.save('products');

                // Copy clients
                const sourceClients = (this.data.clients || []).filter(c => c.localId === sourceLocalId);
                sourceClients.forEach(cli => {
                    const newId = generateId('client');
                    this.data.clients.push({ ...cli, id: newId, localId: targetLocalId, credit: 0, purchases: 0, createdAt: now });
                });
                this.save('clients');

                // Copy suppliers
                const sourceSuppliers = (this.data.suppliers || []).filter(s => s.localId === sourceLocalId);
                sourceSuppliers.forEach(sup => {
                    const newId = generateId('supplier');
                    this.data.suppliers.push({ ...sup, id: newId, localId: targetLocalId, totalPurchases: 0, createdAt: now });
                });
                this.save('suppliers');

                // Copy promotions
                const sourcePromotions = (this.data.promotions || []).filter(p => p.localId === sourceLocalId);
                sourcePromotions.forEach(promo => {
                    const newId = generateId('promo');
                    this.data.promotions.push({ ...promo, id: newId, localId: targetLocalId, createdAt: now });
                });
                this.save('promotions');

                console.log(`[DataStore] Catálogo copiado de ${sourceLocalId} a ${targetLocalId}`);
                this.notify('products');
                this.notify('categories');
                this.notify('clients');
                this.notify('suppliers');
                this.notify('taxes');
                this.notify('promotions');
            }

            seedEmptyCatalog(targetLocalId) {
                const now = Date.now();
                const generateId = (prefix) => prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

                // Seed default taxes
                const defaultTaxes = [
                    { id: generateId('tax'), name: 'IVA 15%', rate: 15, isDefault: true, active: true, description: 'Impuesto al Valor Agregado - Tasa General', localId: targetLocalId, createdAt: now },
                    { id: generateId('tax'), name: 'IVA 0% (Exento)', rate: 0, isDefault: false, active: true, description: 'Productos exentos de IVA', localId: targetLocalId, createdAt: now },
                    { id: generateId('tax'), name: 'IVA 5%', rate: 5, isDefault: false, active: true, description: 'IVA Reducido', localId: targetLocalId, createdAt: now }
                ];
                this.data.taxes = [...(this.data.taxes || []), ...defaultTaxes];
                this.save('taxes');

                // Seed default categories
                const defaultCategories = [
                    { id: generateId('cat'), name: 'General', color: '#3b82f6', icon: 'fa-box', localId: targetLocalId, createdAt: now },
                    { id: generateId('cat'), name: 'Bebidas', color: '#10b981', icon: 'fa-wine-bottle', localId: targetLocalId, createdAt: now },
                    { id: generateId('cat'), name: 'Alimentos', color: '#f59e0b', icon: 'fa-utensils', localId: targetLocalId, createdAt: now }
                ];
                this.data.categories = [...(this.data.categories || []), ...defaultCategories];
                this.save('categories');

                console.log(`[DataStore] Catálogo por defecto creado para ${targetLocalId}`);
                this.notify('taxes');
                this.notify('categories');
            }

            getAccessibleLocals() {
                const allLocals = this.get('locales');
                const userAllLocals = AppState.tenant?.allLocals === true || AppState.userRole === 'admin';
                if (userAllLocals) return allLocals;
                const allowedIds = AppState.tenant?.localIds;
                // If no localIds configured yet (backward compatibility), allow all locales
                if (!Array.isArray(allowedIds) || allowedIds.length === 0) return allLocals;
                const idSet = new Set(allowedIds);
                return allLocals.filter(l => idSet.has(l.id));
            }

            getUserAccessibleLocalIds() {
                const userAllLocals = AppState.tenant?.allLocals === true || AppState.userRole === 'admin';
                if (userAllLocals) return new Set((this.data.locales || []).map(l => l.id));
                const allowedIds = AppState.tenant?.localIds;
                if (!Array.isArray(allowedIds) || allowedIds.length === 0) return new Set((this.data.locales || []).map(l => l.id));
                return new Set(allowedIds);
            }

            getLocalCashRegisters() {
                const localTerminalIds = new Set((this.get('posTerminals') || []).map(t => t.id));
                const result = {};
                for (const [tid, cr] of Object.entries(this.data.cashRegisters || {})) {
                    if (localTerminalIds.has(tid)) result[tid] = cr;
                }
                return result;
            }
            
            search(collection, query, fields) {
                const q = query.toLowerCase();
                return this.data[collection].filter(item => 
                    fields.some(field => String(item[field]).toLowerCase().includes(q))
                );
            }
            
            filter(collection, predicate) {
                return this.data[collection].filter(predicate);
            }
            
            // ==================== WAREHOUSE MANAGEMENT ====================
            getProductStockInWarehouse(productId, warehouseId, variantKey = null) {
                const normalizedVariant = variantKey || null;
                return this.data.warehouseStock
                    .filter(ws => ws.productId === productId && ws.warehouseId === warehouseId && (ws.variantKey || null) === normalizedVariant)
                    .reduce((sum, ws) => sum + ws.quantity, 0);
            }
            
            getWarehouseStock(warehouseId) {
                return this.data.warehouseStock.filter(ws => ws.warehouseId === warehouseId);
            }
            
            getProductTotalStock(productId, variantKey = null) {
                const normalizedVariant = variantKey || null;
                const localWarehouses = new Set(
                    (this.data.warehouses || [])
                        .filter(w => !AppState.currentLocalId || w.localId === AppState.currentLocalId)
                        .map(w => w.id)
                );
                return this.data.warehouseStock
                    .filter(ws => ws.productId === productId && localWarehouses.has(ws.warehouseId) && (ws.variantKey || null) === normalizedVariant)
                    .reduce((sum, ws) => sum + ws.quantity, 0);
            }
            
            getVariantStockByWarehouse(productId, variantKey) {
                const normalizedVariant = variantKey || null;
                return this.data.warehouseStock
                    .filter(ws => ws.productId === productId && (ws.variantKey || null) === normalizedVariant)
                    .map(ws => ({
                        warehouseId: ws.warehouseId,
                        warehouseName: (this.data.warehouses.find(w => w.id === ws.warehouseId)?.name) || 'Desconocido',
                        quantity: ws.quantity,
                        lotNumber: ws.lotNumber || null,
                        expiryDate: ws.expiryDate || null
                    }));
            }
            
            getProductLotStock(productId, warehouseId, lotNumber = null, expiryDate = null, variantKey = null) {
                const normalizedLot = lotNumber || null;
                const normalizedExpiry = expiryDate || null;
                const normalizedVariant = variantKey || null;
                const entry = this.data.warehouseStock.find(ws =>
                    ws.productId === productId &&
                    ws.warehouseId === warehouseId &&
                    (ws.lotNumber || null) === normalizedLot &&
                    (ws.expiryDate || null) === normalizedExpiry &&
                    (ws.variantKey || null) === normalizedVariant
                );
                return entry ? entry.quantity : 0;
            }

            addInventoryMovement({ productId, warehouseId, type, referenceId, lotNumber, expiryDate, variantKey, quantity, runningBalance, notes }) {
                const movement = {
                    id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    productId,
                    warehouseId,
                    type: type || 'adjustment',
                    referenceId: referenceId || null,
                    lotNumber: lotNumber || null,
                    expiryDate: expiryDate || null,
                    variantKey: variantKey || null,
                    quantity: Number(quantity) || 0,
                    runningBalance: Number(runningBalance) || 0,
                    notes: notes || '',
                    userId: AppState.user?.uid || 'demo',
                    userName: AppState.user?.displayName || AppState.user?.email || 'Demo User',
                    timestamp: Date.now(),
                    localId: AppState.currentLocalId || this.getDefaultLocalId() || null
                };
                this.data.inventoryMovements.unshift(movement);
                if (this.data.inventoryMovements.length > 5000) this.data.inventoryMovements.length = 5000;
                this.save('inventoryMovements');
                this.notify('inventoryMovements');
                this._scheduleCloudSync('inventoryMovements', movement);
                return movement;
            }

            getInventoryMovements(productId, warehouseId, options = {}) {
                let movements = this.data.inventoryMovements;
                if (productId) movements = movements.filter(m => m.productId === productId);
                if (warehouseId) movements = movements.filter(m => m.warehouseId === warehouseId);
                if (options.type) movements = movements.filter(m => m.type === options.type);
                if (options.referenceId) movements = movements.filter(m => m.referenceId === options.referenceId);
                if (options.lotNumber) movements = movements.filter(m => (m.lotNumber || null) === (options.lotNumber || null));
                if (options.variantKey !== undefined) movements = movements.filter(m => (m.variantKey || null) === (options.variantKey || null));
                if (options.fromDate) movements = movements.filter(m => m.timestamp >= options.fromDate);
                if (options.toDate) movements = movements.filter(m => m.timestamp <= options.toDate);
                return movements.slice(0, options.limit || 200);
            }
            
            updateWarehouseStock(productId, warehouseId, quantity, lotNumber = null, expiryDate = null, options = {}) {
                const normalizedLot = lotNumber || null;
                const normalizedExpiry = expiryDate || null;
                const normalizedVariant = options.variantKey || null;
                const existingIndex = this.data.warehouseStock.findIndex(ws =>
                    ws.productId === productId &&
                    ws.warehouseId === warehouseId &&
                    (ws.lotNumber || null) === normalizedLot &&
                    (ws.expiryDate || null) === normalizedExpiry &&
                    (ws.variantKey || null) === normalizedVariant
                );
                const oldQty = existingIndex >= 0 ? this.data.warehouseStock[existingIndex].quantity : 0;
                const newQty = Math.max(0, quantity);
                const delta = newQty - oldQty;
                if (existingIndex >= 0) {
                    this.data.warehouseStock[existingIndex].quantity = newQty;
                    this.data.warehouseStock[existingIndex].updatedAt = Date.now();
                    if (lotNumber) this.data.warehouseStock[existingIndex].lotNumber = lotNumber;
                    if (expiryDate) this.data.warehouseStock[existingIndex].expiryDate = expiryDate;
                    if (normalizedVariant !== null) this.data.warehouseStock[existingIndex].variantKey = normalizedVariant;
                } else {
                    this.data.warehouseStock.push({
                        id: 'ws_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        productId,
                        warehouseId,
                        quantity: newQty,
                        lotNumber,
                        expiryDate,
                        variantKey: normalizedVariant,
                        createdAt: Date.now(),
                        localId: AppState.currentLocalId || this.getDefaultLocalId() || null
                    });
                }
                this.save('warehouseStock');
                this.notify('warehouseStock');
                const entry = this.data.warehouseStock[existingIndex >= 0 ? existingIndex : this.data.warehouseStock.length - 1];
                if (entry) this._scheduleCloudSync('warehouseStock', entry);
                if (delta !== 0) {
                    this.addInventoryMovement({
                        productId, warehouseId, lotNumber, expiryDate,
                        variantKey: normalizedVariant,
                        quantity: delta,
                        runningBalance: newQty,
                        type: options.type || 'adjustment',
                        referenceId: options.referenceId || null,
                        notes: options.notes || ''
                    });
                }
            }
            
            deductWarehouseStock(productId, warehouseId, quantity, specificLotNumber = null, specificExpiryDate = null, options = {}) {
                const qtyToDeduct = Math.max(0, quantity);
                if (qtyToDeduct === 0) return true;
                const normalizedVariant = options.variantKey || null;
                
                if ((specificLotNumber !== null && specificLotNumber !== undefined && specificLotNumber !== '') ||
                    (specificExpiryDate !== null && specificExpiryDate !== undefined && specificExpiryDate !== '')) {
                    const normalizedLot = specificLotNumber || null;
                    const normalizedExpiry = specificExpiryDate || null;
                    const idx = this.data.warehouseStock.findIndex(ws =>
                        ws.productId === productId &&
                        ws.warehouseId === warehouseId &&
                        (ws.lotNumber || null) === normalizedLot &&
                        (ws.expiryDate || null) === normalizedExpiry &&
                        (ws.variantKey || null) === normalizedVariant
                    );
                    if (idx >= 0) {
                        const newQty = Math.max(0, this.data.warehouseStock[idx].quantity - qtyToDeduct);
                        this.data.warehouseStock[idx].quantity = newQty;
                        this.data.warehouseStock[idx].updatedAt = Date.now();
                        this.save('warehouseStock');
                        this.notify('warehouseStock');
                        this._scheduleCloudSync('warehouseStock', this.data.warehouseStock[idx]);
                        this.addInventoryMovement({
                            productId, warehouseId,
                            lotNumber: specificLotNumber || null,
                            expiryDate: specificExpiryDate || null,
                            variantKey: normalizedVariant,
                            quantity: -qtyToDeduct,
                            runningBalance: newQty,
                            type: options.type || 'adjustment',
                            referenceId: options.referenceId || null,
                            notes: options.notes || ''
                        });
                        return true;
                    }
                    return false;
                }
                
                // Sin lote específico: deducir FIFO por fecha de caducidad (respetando variantKey)
                const lots = this.data.warehouseStock
                    .filter(ws => ws.productId === productId && ws.warehouseId === warehouseId && (ws.variantKey || null) === normalizedVariant && ws.quantity > 0)
                    .sort((a, b) => {
                        if (a.expiryDate && b.expiryDate) return new Date(a.expiryDate) - new Date(b.expiryDate);
                        if (a.expiryDate) return -1;
                        if (b.expiryDate) return 1;
                        return a.createdAt - b.createdAt;
                    });
                
                let remaining = qtyToDeduct;
                const modifiedEntries = [];
                for (const lot of lots) {
                    if (remaining <= 0) break;
                    const deduct = Math.min(lot.quantity, remaining);
                    lot.quantity -= deduct;
                    lot.updatedAt = Date.now();
                    remaining -= deduct;
                    modifiedEntries.push(lot);
                    this.addInventoryMovement({
                        productId, warehouseId,
                        lotNumber: lot.lotNumber || null,
                        expiryDate: lot.expiryDate || null,
                        variantKey: normalizedVariant,
                        quantity: -deduct,
                        runningBalance: lot.quantity,
                        type: options.type || 'adjustment',
                        referenceId: options.referenceId || null,
                        notes: options.notes || ''
                    });
                }
                
                this.save('warehouseStock');
                this.notify('warehouseStock');
                modifiedEntries.forEach(entry => this._scheduleCloudSync('warehouseStock', entry));
                return remaining === 0;
            }
            
            createTransfer(fromWarehouseId, toWarehouseId, items, notes = '') {
                const transfer = {
                    id: 'trans_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    fromWarehouseId,
                    toWarehouseId,
                    items: items.map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        quantity: item.quantity,
                        lotNumber: item.lotNumber || null,
                        expiryDate: item.expiryDate || null,
                        variantKey: item.variantKey || null
                    })),
                    status: 'pending',
                    notes,
                    createdAt: Date.now(),
                    completedAt: null
                };
                this.add('transfers', transfer);
                return transfer;
            }
            
            completeTransfer(transferId) {
                const transfer = this.getById('transfers', transferId);
                if (!transfer || transfer.status !== 'pending') return false;
                
                // Verificar stock disponible (por variante si aplica)
                for (const item of transfer.items) {
                    const currentStock = this.getProductStockInWarehouse(item.productId, transfer.fromWarehouseId, item.variantKey || null);
                    if (currentStock < item.quantity) {
                        return { success: false, error: `Stock insuficiente para ${item.productName}` };
                    }
                }
                
                // Ejecutar transferencia
                for (const item of transfer.items) {
                    // Descontar del origen (por lote si está especificado, si no FIFO)
                    this.deductWarehouseStock(item.productId, transfer.fromWarehouseId, item.quantity, item.lotNumber, item.expiryDate, {
                        variantKey: item.variantKey || null,
                        type: 'transfer',
                        referenceId: transfer.id,
                        notes: `Transferencia a almacen ${transfer.toWarehouseId}`
                    });
                    
                    // Agregar al destino
                    const toStock = this.getProductLotStock(item.productId, transfer.toWarehouseId, item.lotNumber, item.expiryDate, item.variantKey || null);
                    this.updateWarehouseStock(item.productId, transfer.toWarehouseId, toStock + item.quantity, item.lotNumber, item.expiryDate, {
                        variantKey: item.variantKey || null,
                        type: 'transfer',
                        referenceId: transfer.id,
                        notes: `Transferencia desde almacen ${transfer.fromWarehouseId}`
                    });
                }
                
                // Actualizar estado
                transfer.status = 'completed';
                transfer.completedAt = Date.now();
                this.update('transfers', transferId, transfer);
                
                return { success: true };
            }
            
            getExpiryAlerts(daysThreshold = 7) {
                const threshold = Date.now() + (daysThreshold * 86400000);
                return this.data.warehouseStock.filter(ws => {
                    if (!ws.expiryDate) return false;
                    const expiry = new Date(ws.expiryDate).getTime();
                    return expiry <= threshold && expiry > Date.now() && ws.quantity > 0;
                });
            }
            
            getExpiredProducts() {
                const now = Date.now();
                return this.data.warehouseStock.filter(ws => {
                    if (!ws.expiryDate) return false;
                    const expiry = new Date(ws.expiryDate).getTime();
                    return expiry <= now && ws.quantity > 0;
                });
            }

            // ==================== TAX MANAGEMENT ====================
            getDefaultTax() {
                const taxes = this.get('taxes');
                return taxes.find(t => t.isDefault && t.active) || taxes.find(t => t.active) || { id: 'tax_default', name: 'IVA 15%', rate: 15 };
            }

            getTaxById(taxId) {
                if (!taxId) return this.getDefaultTax();
                const taxes = this.get('taxes');
                return taxes.find(t => t.id === taxId && t.active) || this.getDefaultTax();
            }

            getActiveTaxes() {
                return this.get('taxes').filter(t => t.active !== false);
            }

            getProductTaxRate(product) {
                if (!product) return this.getDefaultTax().rate;
                if (product.taxId) {
                    const tax = this.getTaxById(product.taxId);
                    return tax.rate;
                }
                // Fallback a impuesto por defecto
                return this.getDefaultTax().rate;
            }
            
            calculateDemandForecast(productId, days = 30) {
                const cutoff = Date.now() - (days * 86400000);
                const sales = this.data.sales.filter(s => 
                    s.status === 'completed' && 
                    s.date && 
                    new Date(s.date).getTime() > cutoff
                );
                
                let totalSold = 0;
                sales.forEach(sale => {
                    sale.items.forEach(item => {
                        if (item.id === productId) {
                            totalSold += item.qty;
                        }
                    });
                });
                
                const dailyAverage = totalSold / days;
                const currentStock = this.getProductTotalStock(productId);
                const daysRemaining = dailyAverage > 0 ? Math.floor(currentStock / dailyAverage) : 999;
                
                return {
                    productId,
                    totalSold,
                    dailyAverage: Math.round(dailyAverage * 100) / 100,
                    currentStock,
                    daysRemaining,
                    suggestedReorderDate: dailyAverage > 0 ? new Date(Date.now() + (daysRemaining * 86400000)).toISOString().split('T')[0] : null,
                    reorderPoint: Math.ceil(dailyAverage * 7) // 7 dias de stock de seguridad
                };
            }
            
            exportAll() {
                return JSON.stringify(this.data, null, 2);
            }
            
            importAll(json) {
                try {
                    const data = JSON.parse(json);
                    Object.keys(data).forEach(key => {
                        this.data[key] = data[key];
                        this.save(key);
                    });
                    this.saveCloudNow();
                    return true;
                } catch (e) { return false; }
            }
            
            clear() {
                Object.keys(this.data).forEach(key => {
                    if (key !== 'settings' && key !== 'users') {
                        this.data[key] = [];
                        this.save(key);
                    }
                });
                this.saveCloudNow();
            }

            // ==================== MULTI-POS HELPERS ====================
            ensureWarehouseStock() {
                if (!Array.isArray(this.data.products) || this.data.products.length === 0) return;
                if (!Array.isArray(this.data.warehouses) || this.data.warehouses.length === 0) return;
                const targetWarehouse = this.data.warehouses.find(w => w.type === 'store') || this.data.warehouses.find(w => w.type === 'general');
                if (!targetWarehouse) return;
                let changed = false;
                for (const product of this.data.products) {
                    if (!product?.id) continue;
                    // Producto sin variantes: migrar stock global
                    if (!product.hasVariants || !Array.isArray(product.variants) || product.variants.length === 0) {
                        const hasEntry = (this.data.warehouseStock || []).some(ws =>
                            ws.productId === product.id &&
                            ws.warehouseId === targetWarehouse.id &&
                            (ws.lotNumber || null) === null &&
                            (ws.expiryDate || null) === null &&
                            (ws.variantKey || null) === null
                        );
                        if (!hasEntry) {
                            if (!Array.isArray(this.data.warehouseStock)) this.data.warehouseStock = [];
                            const entry = {
                                id: 'ws_' + product.id + '_' + targetWarehouse.id,
                                productId: product.id,
                                warehouseId: targetWarehouse.id,
                                quantity: Number(product.stock || 0),
                                lotNumber: null,
                                expiryDate: null,
                                variantKey: null,
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                                localId: AppState.currentLocalId || this.getDefaultLocalId() || null
                            };
                            this.data.warehouseStock.push(entry);
                            this._scheduleCloudSync('warehouseStock', entry);
                            changed = true;
                        }
                    } else {
                        // Producto con variantes: migrar stock de cada variante desde product.variants[].stock
                        for (const variant of product.variants) {
                            if (!variant?.key) continue;
                            const hasEntry = (this.data.warehouseStock || []).some(ws =>
                                ws.productId === product.id &&
                                ws.warehouseId === targetWarehouse.id &&
                                (ws.lotNumber || null) === null &&
                                (ws.expiryDate || null) === null &&
                                (ws.variantKey || null) === variant.key
                            );
                            if (!hasEntry && (variant.stock || 0) > 0) {
                                if (!Array.isArray(this.data.warehouseStock)) this.data.warehouseStock = [];
                                const entry = {
                                    id: 'ws_' + product.id + '_' + variant.key + '_' + targetWarehouse.id,
                                    productId: product.id,
                                    warehouseId: targetWarehouse.id,
                                    quantity: Number(variant.stock || 0),
                                    lotNumber: null,
                                    expiryDate: null,
                                    variantKey: variant.key,
                                    createdAt: Date.now(),
                                    updatedAt: Date.now(),
                                    localId: AppState.currentLocalId || this.getDefaultLocalId() || null
                                };
                                this.data.warehouseStock.push(entry);
                                this._scheduleCloudSync('warehouseStock', entry);
                                changed = true;
                            }
                        }
                    }
                }
                if (changed) {
                    this.save('warehouseStock');
                    console.log('[Stock] warehouseStock inicializado desde product.stock y variantes');
                }
            }

            migratePosTerminals() {
                // Si no hay terminales configurados, crear uno por defecto y migrar cashRegister
                if (!Array.isArray(this.data.posTerminals) || this.data.posTerminals.length === 0) {
                    const defaultTerminal = {
                        id: 'pos_default',
                        name: 'Caja Principal',
                        code: 'C1',
                        isActive: true,
                        printerType: 'auto',
                        printerWidth: 80,
                        openDrawer: 'auto',
                        createdAt: Date.now()
                    };
                    this.data.posTerminals = [defaultTerminal];
                    // Guardar solo localmente para evitar que un cloud save prematuro
                    // suba pos_default a Firestore antes de que los datos del cloud carguen
                    try {
                        localStorage.setItem(this.getLocalStorageKey('posTerminals'), JSON.stringify(this.data.posTerminals));
                    } catch (e) {}
                    console.log('[POS] Terminal por defecto creada (local):', defaultTerminal.name);

                    // Migrar cashRegister antiguo a cashRegisters
                    if (this.data.cashRegister && this.data.cashRegister.movements && this.data.cashRegister.movements.length > 0) {
                        this.data.cashRegisters = {
                            'pos_default': { ...this.data.cashRegister }
                        };
                        try {
                            localStorage.setItem(this.getLocalStorageKey('cashRegisters'), JSON.stringify(this.data.cashRegisters));
                        } catch (e) {}
                        console.log('[POS] Cash register migrado a terminal por defecto');
                    }
                }
            }

            getActivePosTerminal() {
                const key = `rw_active_pos_${this.cloud.tenantId || 'default'}`;
                try {
                    const stored = localStorage.getItem(key);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        const terminal = this.data.posTerminals?.find(t => t.id === parsed.terminalId && t.isActive);
                        if (terminal) return terminal;
                    }
                } catch (e) {}
                // Fallback: primera terminal activa
                return this.data.posTerminals?.find(t => t.isActive) || null;
            }

            setActivePosTerminal(terminalId) {
                const key = `rw_active_pos_${this.cloud.tenantId || 'default'}`;
                localStorage.setItem(key, JSON.stringify({ terminalId, selectedAt: Date.now() }));
            }

            getCashRegisterForTerminal(terminalId) {
                if (!this.data.cashRegisters) this.data.cashRegisters = {};
                if (!this.data.cashRegisters[terminalId]) {
                    this.data.cashRegisters[terminalId] = { isOpen: false, openingAmount: 0, currentAmount: 0, movements: [] };
                }
                return this.data.cashRegisters[terminalId];
            }

            getCurrentCashRegister() {
                const terminal = this.getActivePosTerminal();
                if (!terminal) return this.getCashRegisterForTerminal('pos_default');
                return this.getCashRegisterForTerminal(terminal.id);
            }

            getUserOpenCashRegister(userId) {
                if (!this.data.cashRegisters || !userId) return null;
                for (const [tid, cr] of Object.entries(this.data.cashRegisters)) {
                    if (cr.isOpen && cr.openedBy === userId) {
                        return { terminalId: tid, ...cr };
                    }
                }
                return null;
            }

            getPosTerminalById(id) {
                return this.data.posTerminals?.find(t => t.id === id);
            }

            getNextPosCode() {
                if (!Array.isArray(this.data.posTerminals) || this.data.posTerminals.length === 0) return 'C1';
                const codes = this.data.posTerminals
                    .map(t => t.code)
                    .filter(c => /^C\d+$/.test(c))
                    .map(c => parseInt(c.replace('C', ''), 10));
                const max = Math.max(0, ...codes);
                return 'C' + (max + 1);
            }

            addPosTerminal(terminal) {
                terminal.id = terminal.id || 'pos_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                terminal.createdAt = terminal.createdAt || Date.now();
                if (!terminal.code) terminal.code = this.getNextPosCode();
                if (!Array.isArray(this.data.posTerminals)) this.data.posTerminals = [];
                this.data.posTerminals.push(terminal);
                this.save('posTerminals');
                this.notify('posTerminals');
                return terminal;
            }

            updatePosTerminal(id, updates) {
                const index = this.data.posTerminals?.findIndex(t => t.id === id);
                if (index !== -1 && index !== undefined) {
                    this.data.posTerminals[index] = { ...this.data.posTerminals[index], ...updates, updatedAt: Date.now() };
                    this.save('posTerminals');
                    this.notify('posTerminals');
                    return this.data.posTerminals[index];
                }
                return null;
            }

            deletePosTerminal(id) {
                if (!Array.isArray(this.data.posTerminals)) return false;
                // No eliminar si tiene ventas asociadas
                const hasSales = this.data.sales?.some(s => s.posTerminalId === id);
                if (hasSales) return false;
                this.data.posTerminals = this.data.posTerminals.filter(t => t.id !== id);
                this.save('posTerminals');
                this.notify('posTerminals');
                return true;
            }

            addPosTerminalClosure(closure) {
                closure.id = closure.id || 'closure_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                closure.createdAt = closure.createdAt || Date.now();
                if (!Array.isArray(this.data.posTerminalClosures)) this.data.posTerminalClosures = [];
                this.data.posTerminalClosures.push(closure);
                this.save('posTerminalClosures');
                this.notify('posTerminalClosures');
                return closure;
            }
        }


var store = new DataStore();
window.store = store;
