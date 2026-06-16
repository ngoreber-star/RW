/**
 * FIREBASE COMPATIBILITY LAYER
 * Prevents legacy code from crashing when Firebase is removed.
 * All functions are no-ops or return empty data structures.
 */

(function(global) {
    'use strict';

    // Prevent double-init
    if (global.__FIREBASE_COMPAT_LOADED__) return;
    global.__FIREBASE_COMPAT_LOADED__ = true;

    // Mock Firestore document reference
    function createMockRef(path) {
        return { path: path || '', id: path?.split('/')?.pop() || '' };
    }

    // Mock QuerySnapshot
    function createMockSnap(docs = []) {
        return {
            docs: docs.map(d => ({
                id: d.id || '',
                data: () => d,
                exists: () => true,
            })),
            empty: docs.length === 0,
            size: docs.length,
            forEach: (cb) => docs.forEach((d, i) => cb({ id: d.id, data: () => d, exists: () => true })),
        };
    }

    // Mock DocumentSnapshot
    function createMockDocSnap(data) {
        const exists = !!data;
        return {
            id: data?.id || '',
            data: () => data || {},
            exists: () => exists,
            get: (field) => data?.[field],
        };
    }

    // Stub functions
    global.db = { app: { name: '[DEFAULT]' } };
    global.auth = { currentUser: null };
    global.storage = {};

    global.collection = function(db, ...path) {
        return createMockRef(path.join('/'));
    };

    global.doc = function(db, ...path) {
        return createMockRef(path.join('/'));
    };

    global.getDoc = async function(ref) {
        console.warn('[FirebaseCompat] getDoc called (no-op)', ref?.path);
        return createMockDocSnap(null);
    };

    global.getDocs = async function(query) {
        console.warn('[FirebaseCompat] getDocs called (no-op)');
        return createMockSnap([]);
    };

    global.setDoc = async function(ref, data, opts) {
        console.warn('[FirebaseCompat] setDoc called (no-op)', ref?.path);
    };

    global.updateDoc = async function(ref, data) {
        console.warn('[FirebaseCompat] updateDoc called (no-op)', ref?.path);
    };

    global.getCurrentPlan = function() {
        // Return tenant plan from Supabase adapter if available
        const tenant = window.AuthManager?.currentTenant;
        if (tenant?.plan) return tenant.plan;
        if (tenant?.license_type) return tenant.license_type;
        return 'enterprise';
    };

    global.planLevel = function(plan) {
        const levels = { trial: 0, lite: 1, basic: 2, pro: 3, enterprise: 4 };
        return levels[plan] || 4;
    };

    global.deleteDoc = async function(ref) {
        console.warn('[FirebaseCompat] deleteDoc called (no-op)', ref?.path);
    };

    global.addDoc = async function(ref, data) {
        console.warn('[FirebaseCompat] addDoc called (no-op)');
        return { id: 'mock_' + Date.now() };
    };

    global.writeBatch = function(db) {
        return {
            set: () => {},
            update: () => {},
            delete: () => {},
            commit: async () => {},
        };
    };

    global.runTransaction = async function(db, fn) {
        const mockTx = {
            get: async (ref) => createMockDocSnap(null),
            set: () => {},
            update: () => {},
            delete: () => {},
        };
        return await fn(mockTx);
    };

    global.onSnapshot = function(ref, opts, callback) {
        console.warn('[FirebaseCompat] onSnapshot called (no-op)');
        if (typeof opts === 'function') callback = opts;
        // Call once with empty data
        if (callback) callback(createMockSnap([]));
        return () => {}; // unsubscribe
    };

    global.query = function(ref, ...constraints) {
        return ref;
    };

    global.where = function(field, op, value) {
        return { type: 'where', field, op, value };
    };

    global.orderBy = function(field, dir) {
        return { type: 'orderBy', field, dir };
    };

    global.limit = function(n) {
        return { type: 'limit', n };
    };

    global.startAfter = function(doc) {
        return { type: 'startAfter', doc };
    };

    global.serverTimestamp = function() {
        return new Date().toISOString();
    };

    global.deleteField = function() {
        return null;
    };

    global.increment = function(n) {
        return n;
    };

    global.ref = function(storage, path) {
        return { path };
    };

    global.uploadBytes = async function(ref, data) {
        return { ref };
    };

    global.getDownloadURL = async function(ref) {
        return '';
    };

    // Auth stubs
    global.signInWithEmailAndPassword = async function(auth, email, password) {
        throw new Error('Firebase Auth removed. Use Supabase auth.');
    };

    global.createUserWithEmailAndPassword = async function(auth, email, password) {
        console.warn('[FirebaseCompat] createUserWithEmailAndPassword called (no-op)');
        return { user: { uid: 'mock_' + Date.now(), email } };
    };

    global.onAuthStateChanged = function(auth, callback) {
        console.warn('[FirebaseCompat] onAuthStateChanged called (no-op)');
        callback(null);
        return () => {};
    };

    global.signOut = async function(auth) {
        console.warn('[FirebaseCompat] signOut called (no-op)');
    };

    global.initializeApp = function(config, name) {
        console.warn('[FirebaseCompat] initializeApp called (no-op)');
        return { name: name || '[DEFAULT]', options: config };
    };

    global.getAuth = function(app) {
        return global.auth;
    };

    global.getFirestore = function(app) {
        return global.db;
    };

    global.getStorage = function(app) {
        return global.storage;
    };

    global.deleteApp = async function(app) {
        console.warn('[FirebaseCompat] deleteApp called (no-op)');
    };

    global.setPersistence = async function(auth, persistence) {};
    global.browserLocalPersistence = 'local';
    global.browserSessionPersistence = 'session';
    global.inMemoryPersistence = 'memory';

    global.licenseManager = {
        generateToken: (payload) => 'mock_token_' + Date.now(),
        storeLicense: (token) => localStorage.setItem('rw_license_token', token),
        getStoredLicense: () => null,
        isValid: () => true,
        getPlan: () => 'enterprise',
        getDaysRemaining: () => 999,
        getExpiryDate: () => new Date(Date.now() + 86400000 * 999).toISOString(),
        verifyToken: (token) => ({ tenant: 'default', plan: 'enterprise', days: 999, features: ['all'] })
    };

    global.isPageAllowed = function(page) { return true; };

    console.log('[FirebaseCompat] Loaded. Legacy Firebase calls will be no-ops.');

})(window);
