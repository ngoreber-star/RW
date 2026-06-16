export function createMockSupabase(options = {}) {
    const {
        rpcResult = null,
        rpcError = null,
        rpcThrow = false,
        tableData = [],
        insertResult = null,
        insertError = null,
        updateResult = null,
        updateError = null,
        deleteResult = null,
        deleteError = null,
        selectResult = null,
        selectError = null,
        channelStatus = 'SUBSCRIBED',
    } = options;

    const filters = {};

    function buildFilter(column, operator, value) {
        filters[column] = { operator, value };
    }

    function buildQuery() {
        let result = selectResult !== null ? selectResult : { data: tableData, error: selectError };
        let error = selectError;

        const query = {
            eq: (col, val) => { buildFilter(col, 'eq', val); return query; },
            maybeSingle: () => {
                const arr = result.data || [];
                return Promise.resolve({ data: arr.length > 0 ? arr[0] : null, error: null });
            },
            single: () => {
                const arr = result.data || [];
                return Promise.resolve({ data: arr.length > 0 ? arr[0] : null, error: arr.length === 0 ? { message: 'Not found' } : null });
            },
            order: () => query,
            limit: () => query,
            range: () => query,
            then: (resolve) => resolve(result),
            catch: () => {},
        };
        return query;
    }

    const mockClient = {
        rpc: (fnName, params) => {
            if (rpcThrow) return Promise.reject(new Error('RPC failed'));
            return Promise.resolve({ data: rpcResult, error: rpcError });
        },
        from: (table) => ({
            select: (columns) => buildQuery(),
            insert: (data) => {
                if (insertError) return Promise.resolve({ data: null, error: insertError });
                return Promise.resolve({ data: insertResult || data, error: null });
            },
            update: (data) => ({
                eq: (col, val) => Promise.resolve({ data: updateResult || data, error: updateError }),
                ...buildQuery(),
            }),
            delete: () => ({
                eq: (col, val) => Promise.resolve({ data: deleteResult || null, error: deleteError }),
                ...buildQuery(),
            }),
            ...buildQuery(),
        }),
        channel: (name) => ({
            on: (type, config, callback) => ({
                subscribe: (cb) => {
                    if (cb) cb(channelStatus);
                    return { unsubscribe: () => {} };
                },
            }),
            subscribe: (cb) => {
                if (cb) cb(channelStatus);
                return { unsubscribe: () => {} };
            },
            unsubscribe: () => {},
        }),
        removeChannel: () => {},
        removeAllChannels: () => {},
        auth: {
            signUp: () => Promise.resolve({ data: { user: { id: 'test-user-id' } }, error: null }),
            signInWithPassword: () => Promise.resolve({ data: { user: { id: 'test-user-id' }, session: { access_token: 'test-token' } }, error: null }),
            signOut: () => Promise.resolve({ error: null }),
            getSession: () => Promise.resolve({ data: { session: { access_token: 'test-token' } }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        },
        realtime: {
            setDebug: () => {},
        },
    };

    return mockClient;
}

export function createMockLocalStorage() {
    const store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); },
        get length() { return Object.keys(store).length; },
        key: (index) => Object.keys(store)[index] || null,
    };
}

export function createMockOfflineAuth(options = {}) {
    const { isOnline = true } = options;
    return {
        register: () => Promise.resolve(),
        login: () => Promise.resolve(),
        logout: () => {},
        markSynced: () => {},
        getSession: () => null,
        isOnline: () => isOnline,
    };
}
