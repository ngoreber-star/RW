/**
 * Firestore → Supabase Compatibility Layer
 * Provides Firebase-like APIs for legacy HTML files migrated to Supabase.
 * Not a full Firestore emulator — covers the specific APIs used by CRM, store, and portals.
 */
(function(global) {
    'use strict';

    // ── Lazy Supabase init ──
    let _pkg = null;
    async function getPkg() {
        if (_pkg) return _pkg;
        if (!global.SupabaseClient) throw new Error('[FirestoreCompat] SupabaseClient not available. Load supabase-client.js first.');
        _pkg = await global.SupabaseClient.init();
        return _pkg;
    }
    async function getSb() {
        const pkg = await getPkg();
        return pkg.supabase;
    }

    // ── Path parsing ──
    // Firestore paths:
    //   rw_tenants/{tenantId}/users/{scopeId}/{collection}  → table with tenant_id
    //   rw_tenants/{tenantId}/publicStoreSettings           → tenant_settings
    //   rw_tenants/{tenantId}/catalog                       → products
    //   rw_tenants/{tenantId}/categories                    → categories
    //   rw_tenants/{tenantId}/publicOrders/{orderId}        → public_orders
    //   rw_tenants/{tenantId}/publicOrders/{orderId}/messages/{msgId} → public_order_messages (order_id)
    //   rw_tenants/{tenantId}/publicOrderCodes/{code}       → public_order_codes
    //   rw_public_deliveries/{trackingCode}                 → public_deliveries
    //   users/{uid}                                         → special: resolve tenant via RPC

    function parsePath(paths) {
        if (paths[0] === 'rw_tenants') {
            const tenantId = paths[1];
            const p3 = paths[3]; // scopeId (usually same as tenantId)
            const p4 = paths[4]; // collection or docId
            const p5 = paths[5];
            const p6 = paths[6];

            // Subcollection: rw_tenants/{t}/users/{scope}/{collection}
            if (paths[2] === 'users' && p4 && !p5) {
                return { mode: 'table', tenantId, table: toSnake(p4) };
            }
            // Document in subcollection: rw_tenants/{t}/users/{scope}/{collection}/{docId}
            if (paths[2] === 'users' && p4 && p5) {
                return { mode: 'doc', tenantId, table: toSnake(p4), docId: p5 };
            }
            // Special single-doc collections under tenant
            if (paths[2] !== 'users') {
                const collection = paths[2];
                const docId = paths[3];
                const sub = paths[4];
                const subDoc = paths[5];

                if (collection === 'publicStoreSettings') {
                    return { mode: 'doc', tenantId, table: 'tenant_settings', docId: docId || tenantId };
                }
                if (collection === 'catalog') {
                    return { mode: 'table', tenantId, table: 'products' };
                }
                if (collection === 'categories') {
                    return { mode: 'table', tenantId, table: 'categories' };
                }
                if (collection === 'publicOrders') {
                    if (!sub) {
                        return { mode: 'doc', tenantId, table: 'public_orders', docId };
                    }
                    if (sub === 'messages' && subDoc) {
                        return { mode: 'doc', tenantId, table: 'public_order_messages', docId: subDoc, parentOrderId: docId };
                    }
                    if (sub === 'messages') {
                        return { mode: 'table', tenantId, table: 'public_order_messages', parentOrderId: docId };
                    }
                    return { mode: 'doc', tenantId, table: 'public_orders', docId };
                }
                if (collection === 'publicOrderCodes') {
                    return { mode: 'doc', tenantId, table: 'public_order_codes', docId };
                }
            }
        }

        if (paths[0] === 'rw_public_deliveries') {
            return { mode: 'doc', table: 'public_deliveries', docId: paths[1] };
        }

        if (paths[0] === 'users') {
            return { mode: 'users', uid: paths[1] };
        }

        console.warn('[FirestoreCompat] Unrecognized path:', paths);
        return { mode: 'unknown', paths };
    }

    function toSnake(str) {
        const map = {
            clients: 'clients',
            loyaltyCards: 'loyalty_cards',
            walletTransactions: 'wallet_transactions',
            crmCoupons: 'crm_coupons',
            crmCouponPurchases: 'crm_coupon_purchases',
            reloadRequests: 'reload_requests',
            discountCampaigns: 'discount_campaigns',
            crmActivities: 'crm_activities',
            products: 'products',
            categories: 'categories',
            publicOrders: 'public_orders',
            publicOrderCodes: 'public_order_codes',
            messages: 'public_order_messages',
            publicStoreSettings: 'tenant_settings',
            catalog: 'products',
            deliveries: 'deliveries',
            publicDeliveries: 'public_deliveries'
        };
        return map[str] || str;
    }

    // ── Auth compatibility ──
    class CompatAuth {
        constructor(supabaseAuth) {
            this._auth = supabaseAuth;
            this.currentUser = supabaseAuth.currentUser || supabaseAuth.currentSession?.user || null;
        }
    }

    async function initCompat(config) {
        // config is ignored — we use window.ENV + SupabaseClient
        const sb = await getSb();
        return { _type: 'compatApp', supabase: sb };
    }

    async function getAuth(app) {
        const sb = await getSb();
        return new CompatAuth(sb.auth);
    }

    function onAuthStateChanged(auth, callback) {
        // auth here is a CompatAuth or placeholder
        getSb().then(sb => {
            const { data } = sb.auth.onAuthStateChange((event, session) => {
                const user = session?.user || null;
                if (auth && typeof auth === 'object') auth.currentUser = user;
                callback(user);
            });
            // Return unsubscribe function
            if (typeof data?.subscription?.unsubscribe === 'function') {
                // Store for cleanup if needed
            }
        });
        // Return a dummy unsubscribe
        return () => {};
    }

    async function signInAnonymously(auth) {
        const sb = await getSb();
        const { data, error } = await sb.auth.signInAnonymously();
        if (error) throw error;
        return { user: data.user };
    }

    // ── Firestore references ──
    function getFirestore(app) {
        return { _type: 'compatDb' };
    }

    function collection(db, ...paths) {
        return { _type: 'collection', paths };
    }

    function doc(db, ...paths) {
        return { _type: 'doc', paths };
    }

    // ── Constraints ──
    function where(field, op, value) {
        return { _type: 'where', field, op, value };
    }
    function orderBy(field, direction) {
        return { _type: 'orderBy', field, direction: direction || 'asc' };
    }
    function limit(n) {
        return { _type: 'limit', n };
    }
    function query(collectionRef, ...constraints) {
        return { _type: 'query', collectionRef, constraints };
    }

    function convertFieldName(field) {
        return _mappings[field] || field;
    }

    // ── CRUD ──
    async function getDocs(queryRef) {
        const sb = await getSb();
        // Handle both query({ collection, ... }) and bare collection ref
        const paths = queryRef.collectionRef ? queryRef.collectionRef.paths : queryRef.paths;
        const parsed = parsePath(paths);
        if (parsed.mode === 'users') {
            // Resolve user doc via RPC
            const { data, error } = await sb.rpc('get_user_tenant', { p_user_id: parsed.uid });
            if (error) {
                console.warn('[FirestoreCompat] get_user_tenant RPC failed (will fallback):', error.message || error);
                return { docs: [], empty: true, size: 0 };
            }
            const docs = data ? [{ id: parsed.uid, data: () => ({ tenantId: data.tenant?.id, ...data }), exists() { return true; } }] : [];
            return { docs, empty: docs.length === 0, size: docs.length };
        }

        let q = sb.from(parsed.table).select('*');
        if (parsed.tenantId) {
            q = q.eq('tenant_id', parsed.tenantId);
        }
        if (parsed.parentOrderId) {
            q = q.eq('order_id', parsed.parentOrderId);
        }

        for (const c of queryRef.constraints) {
            if (c._type === 'where') {
                // Convertir campo where a snake_case si aplica
                const field = convertFieldName(c.field);
                if (c.op === '==') q = q.eq(field, c.value);
                else if (c.op === 'in') q = q.in(field, Array.isArray(c.value) ? c.value : [c.value]);
                else if (c.op === '!=') q = q.neq(field, c.value);
                else if (c.op === '>') q = q.gt(field, c.value);
                else if (c.op === '>=') q = q.gte(field, c.value);
                else if (c.op === '<') q = q.lt(field, c.value);
                else if (c.op === '<=') q = q.lte(field, c.value);
            } else if (c._type === 'orderBy') {
                // Convertir campo orderBy a snake_case
                const field = convertFieldName(c.field);
                q = q.order(field, { ascending: c.direction !== 'desc' });
            } else if (c._type === 'limit') {
                q = q.limit(c.n);
            }
        }

        const { data, error } = await q;
        if (error) {
            // Silently return empty for missing tables during transition
            if (error.message && error.message.includes('does not exist')) {
                console.warn('[FirestoreCompat] Table not found:', parsed.table, error.message);
                return { docs: [], empty: true, size: 0 };
            }
            throw error;
        }
        const rows = data || [];
        const toCamelData = (r) => convertToCamel(r);
        return {
            docs: rows.map(r => ({
                id: r.id,
                data: () => toCamelData(r),
                exists() { return true; }
            })),
            empty: rows.length === 0,
            size: rows.length,
            forEach(fn) { rows.forEach(r => fn({ id: r.id, data: () => toCamelData(r), exists() { return true; } })); }
        };
    }

    async function getDoc(docRef) {
        const sb = await getSb();
        const parsed = parsePath(docRef.paths);
        if (parsed.mode === 'users') {
            const { data, error } = await sb.rpc('get_user_tenant', { p_user_id: parsed.uid });
            if (error) {
                console.warn('[FirestoreCompat] get_user_tenant RPC failed (will fallback):', error.message || error);
                return { id: parsed.uid, data: () => ({}), exists() { return false; } };
            }
            const docExists = !!data;
            return {
                id: parsed.uid,
                data: () => (docExists ? { tenantId: data.tenant?.id, role: data.role, ...data.tenant } : {}),
                exists() { return docExists; }
            };
        }
        if (parsed.mode === 'doc' && parsed.table === 'public_order_codes') {
            // Lookup by code (docId is the code string)
            const { data, error } = await sb.from('public_order_codes')
                .select('*')
                .eq('code', parsed.docId)
                .eq('tenant_id', parsed.tenantId)
                .maybeSingle();
            if (error) throw error;
            return { id: parsed.docId, data: () => convertToCamel(data) || {}, exists() { return !!data; } };
        }
        if (parsed.mode === 'doc' && parsed.table === 'public_deliveries') {
            const { data, error } = await sb.from('public_deliveries')
                .select('*')
                .eq('tracking_code', parsed.docId)
                .maybeSingle();
            if (error) throw error;
            return { id: parsed.docId, data: () => convertToCamel(data) || {}, exists() { return !!data; } };
        }

        let q = sb.from(parsed.table).select('*').eq('id', parsed.docId);
        if (parsed.tenantId) q = q.eq('tenant_id', parsed.tenantId);
        if (parsed.parentOrderId) q = q.eq('order_id', parsed.parentOrderId);

        const { data, error } = await q.maybeSingle();
        if (error) throw error;
        return { id: parsed.docId, data: () => convertToCamel(data) || {}, exists() { return !!data; } };
    }

    async function setDoc(docRef, data) {
        const sb = await getSb();
        const parsed = parsePath(docRef.paths);
        let payload = { ...data, id: parsed.docId };
        if (parsed.tenantId) payload.tenant_id = parsed.tenantId;
        if (parsed.parentOrderId) payload.order_id = parsed.parentOrderId;
        // ✅ FIX: usar el objeto retornado (convertToSnake ahora elimina claves camelCase)
        payload = convertToSnake(payload);
        const { error } = await sb.from(parsed.table).upsert(payload, { onConflict: 'id' });
        if (error) throw error;
    }

    async function updateDoc(docRef, data) {
        const sb = await getSb();
        const parsed = parsePath(docRef.paths);
        // ✅ FIX: usar el objeto retornado (convertToSnake ahora elimina claves camelCase)
        const payload = convertToSnake({ ...data });
        let q = sb.from(parsed.table).update(payload).eq('id', parsed.docId);
        if (parsed.tenantId) q = q.eq('tenant_id', parsed.tenantId);
        const { error } = await q;
        if (error) throw error;
    }

    async function deleteDoc(docRef) {
        const sb = await getSb();
        const parsed = parsePath(docRef.paths);
        let q = sb.from(parsed.table).delete().eq('id', parsed.docId);
        if (parsed.tenantId) q = q.eq('tenant_id', parsed.tenantId);
        const { error } = await q;
        if (error) throw error;
    }

    // Replace Firestore serverTimestamp sentinel with current ISO string
    function replaceServerTimestamps(obj) {
        if (obj && typeof obj === 'object') {
            if (obj._serverTimestamp === true) {
                return new Date().toISOString();
            }
            if (Array.isArray(obj)) {
                return obj.map(replaceServerTimestamps);
            }
            const result = {};
            for (const key of Object.keys(obj)) {
                result[key] = replaceServerTimestamps(obj[key]);
            }
            return result;
        }
        return obj;
    }

    // Simple field name conversion for common camelCase keys
    const _mappings = {
        clientId: 'client_id',
        tenantId: 'tenant_id',
        couponId: 'coupon_id',
        orderId: 'order_id',
        relatedClientId: 'related_client_id',
        loyaltyCardNumber: 'loyalty_card_number',
        loyaltyPoints: 'loyalty_points',
        walletBalance: 'wallet_balance',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        requestedAt: 'requested_at',
        resolvedAt: 'resolved_at',
        purchasedAt: 'purchased_at',
        deliveredAt: 'delivered_at',
        scheduledAt: 'scheduled_at',
        validFrom: 'valid_from',
        validUntil: 'valid_until',
        startDate: 'start_date',
        endDate: 'end_date',
        targetTiers: 'target_tiers',
        minPurchase: 'min_purchase',
        maxUses: 'max_uses',
        usesCount: 'uses_count',
        discountType: 'discount_type',
        discountValue: 'discount_value',
        isActive: 'is_active',
        isPublicStore: 'is_public_store',
        isDelivery: 'is_delivery',
        deliveryAddress: 'delivery_address',
        deliveryStatus: 'delivery_status',
        deliveryPerson: 'delivery_person',
        estimatedTime: 'estimated_time',
        paymentMethod: 'payment_method',
        customerName: 'customer_name',
        customerPhone: 'customer_phone',
        customerEmail: 'customer_email',
        firstName: 'first_name',
        lastName: 'last_name',
        pinHash: 'pin_hash',
        balanceAfter: 'balance_after',
        senderName: 'sender_name',
        trackingCode: 'tracking_code',
        serviceTypes: 'service_types',
        storeName: 'store_name',
        orderCode: 'order_code',
        cardNumber: 'card_number',
        taxId: 'tax_id',
        creditLimit: 'credit_limit',
        totalCredit: 'total_credit',
        action: 'activity_type',
        activityType: 'activity_type',
        campaignType: 'campaign_type',
        boxPrice: 'box_price',
        halfBoxPrice: 'half_box_price',
        costSource: 'cost_source',
        costCalculation: 'cost_calculation',
        saleAccountCode: 'sale_account_code',
        purchaseAccountCode: 'purchase_account_code',
        lotNumber: 'lot_number',
        expiryDate: 'expiry_date',
        unitsPerBox: 'units_per_box',
        hasVariants: 'has_variants',
        hasExpiry: 'has_expiry',
        supplierIds: 'supplier_ids',
        saleAccount: 'sale_account',
        purchaseAccount: 'purchase_account',
        category: 'category_id',
        categoryId: 'category_id',
        active: 'is_active',
        image: 'image_url',
        minStock: 'min_stock',
    };

    function convertToSnake(obj) {
        obj = replaceServerTimestamps(obj);
        for (const [camel, snake] of Object.entries(_mappings)) {
            if (camel in obj) {
                obj[snake] = obj[camel];
                delete obj[camel];
            }
        }
        return obj;
    }

    function toCamel(str) {
        return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    }

    function convertToCamel(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        const rev = {};
        for (const [camel, snake] of Object.entries(_mappings)) {
            rev[snake] = camel;
        }
        const result = {};
        for (const key of Object.keys(obj)) {
            const mapped = rev[key];
            if (mapped) {
                result[mapped] = obj[key];
            } else if (key.includes('_')) {
                result[toCamel(key)] = obj[key];
            } else {
                result[key] = obj[key];
            }
        }
        return result;
    }

    // ── Realtime / onSnapshot ──
    function onSnapshot(ref, callback, onError) {
        const isQuery = ref._type === 'query';
        const paths = isQuery ? ref.collectionRef.paths : ref.paths;
        const constraints = isQuery ? ref.constraints : [];
        const parsed = parsePath(paths);

        // For users/{uid} docs, we can't easily subscribe. Poll every 5s.
        if (parsed.mode === 'users') {
            const poll = async () => {
                try {
                    const docSnap = await getDoc({ paths });
                    callback(docSnap);
                } catch (e) { if (onError) onError(e); }
            };
            poll();
            const id = setInterval(poll, 5000);
            return () => clearInterval(id);
        }

        // For table queries, use Supabase Realtime
        getSb().then(sb => {
            const channelName = 'fc:' + parsed.table + ':' + (parsed.tenantId || 'pub') + ':' + (parsed.parentOrderId || '');
            const channel = sb.channel(channelName);

            const filter = { event: '*', schema: 'public', table: parsed.table };
            // Supabase realtime supports only one column filter
            // We filter by tenant_id if available, otherwise no filter
            if (parsed.tenantId) {
                filter.filter = 'tenant_id=eq.' + parsed.tenantId;
            } else if (parsed.table === 'public_deliveries' && parsed.docId) {
                filter.filter = 'tracking_code=eq.' + parsed.docId;
            }

            channel.on('postgres_changes', filter, (payload) => {
                // Refetch the data to match Firestore onSnapshot behavior
                if (isQuery) {
                    getDocs(ref).then(snap => callback(snap)).catch(e => { if (onError) onError(e); });
                } else {
                    getDoc(ref).then(snap => callback(snap)).catch(e => { if (onError) onError(e); });
                }
            }).subscribe((status) => {
                if (status === 'CHANNEL_ERROR' && onError) {
                    onError(new Error('Realtime channel error'));
                }
            });

            // Firestore onSnapshot returns an unsubscribe function
            // We attach it to the channel for cleanup
            ref.__unsub = () => {
                sb.removeChannel(channel);
            };
        }).catch(e => {
            if (onError) onError(e);
        });

        return () => {
            if (ref.__unsub) ref.__unsub();
        };
    }

    function serverTimestamp() {
        // Firestore serverTimestamp is a sentinel. In compat layer we return a string
        // that the write functions detect and replace with NOW().
        return { _serverTimestamp: true };
    }

    async function writeBatch(db) {
        // Not fully implemented — individual writes are used instead
        const ops = [];
        return {
            set: (docRef, data) => { ops.push(() => setDoc(docRef, data)); },
            update: (docRef, data) => { ops.push(() => updateDoc(docRef, data)); },
            delete: (docRef) => { ops.push(() => deleteDoc(docRef)); },
            commit: async () => {
                for (const op of ops) await op();
            }
        };
    }

    // ── Batch write helper for single-table multi-row inserts ──
    // Not a Firestore API, but useful for internal use
    async function insertBatch(table, rows) {
        const sb = await getSb();
        const { error } = await sb.from(table).insert(rows);
        if (error) throw error;
    }

    // ── Expose ──
    global.FirestoreCompat = {
        initializeApp: initCompat,
        getAuth,
        onAuthStateChanged,
        signInAnonymously,
        getFirestore,
        collection,
        doc,
        getDocs,
        getDoc,
        setDoc,
        updateDoc,
        deleteDoc,
        query,
        where,
        orderBy,
        limit,
        onSnapshot,
        serverTimestamp,
        writeBatch,
        insertBatch,
        _getSupabase: getSb
    };

})(window);
