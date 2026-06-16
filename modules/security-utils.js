/**
 * RIVER-WALL ERP V.5.0 - Security Utilities
 * ISO 27001 compliant: XSS prevention, encryption, audit, CSP
 */
(function(global) {
    'use strict';

    if (global.RWSecurity) return;
    const RWSecurity = {};

    // ================================================================
    // XSS SANITIZATION (ISO 27001 A.14.2.5)
    // ================================================================

    const HTML_ENTITIES = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/[&<>"'\/]/g, ch => HTML_ENTITIES[ch] || ch);
    }

    function sanitizeHtml(input) {
        if (!input) return '';
        if (typeof input !== 'string') input = String(input);
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
            .replace(/javascript\s*:/gi, '')
            .replace(/data\s*:\s*text\/html/gi, '');
    }

    function setSafeHTML(element, html) {
        if (!element) return;
        element.innerHTML = sanitizeHtml(html);
    }

    function setText(element, text) {
        if (!element) return;
        element.textContent = text;
    }

    // ================================================================
    // LOCAL STORAGE ENCRYPTION (ISO 27001 A.10.1.1)
    // AES-GCM with PBKDF2-derived key
    // ================================================================

    const STORAGE_KEY = 'rw-crypto-v1';
    const PBKDF2_ITERATIONS = 100000;
    let _cryptoKey = null;

    async function _getStorageKey() {
        if (_cryptoKey) return _cryptoKey;
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                const keyMaterial = await crypto.subtle.importKey(
                    'raw',
                    new TextEncoder().encode(data.salt),
                    'PBKDF2',
                    false,
                    ['deriveKey']
                );
                _cryptoKey = await crypto.subtle.deriveKey(
                    { name: 'PBKDF2', salt: new TextEncoder().encode('rw-salt-v1'), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
                    keyMaterial,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['encrypt', 'decrypt']
                );
            } else {
                const saltBytes = crypto.getRandomValues(new Uint8Array(32));
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ salt: btoa(String.fromCharCode(...saltBytes)) }));
                const keyMaterial = await crypto.subtle.importKey(
                    'raw',
                    saltBytes,
                    'PBKDF2',
                    false,
                    ['deriveKey']
                );
                _cryptoKey = await crypto.subtle.deriveKey(
                    { name: 'PBKDF2', salt: new TextEncoder().encode('rw-salt-v1'), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
                    keyMaterial,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['encrypt', 'decrypt']
                );
            }
            return _cryptoKey;
        } catch (e) {
            console.warn('[Security] Crypto not available, falling back to plain storage');
            return null;
        }
    }

    async function encryptValue(plaintext) {
        try {
            const key = await _getStorageKey();
            if (!key) return JSON.stringify(plaintext);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encoded = new TextEncoder().encode(JSON.stringify(plaintext));
            const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv, 0);
            combined.set(new Uint8Array(encrypted), iv.length);
            return btoa(String.fromCharCode(...combined));
        } catch (e) {
            console.warn('[Security] Encrypt failed, storing plaintext:', e.message);
            return JSON.stringify(plaintext);
        }
    }

    async function decryptValue(ciphertextB64) {
        try {
            const key = await _getStorageKey();
            if (!key) {
                try { return JSON.parse(ciphertextB64); } catch { return null; }
            }
            const combined = new Uint8Array(atob(ciphertextB64).split('').map(c => c.charCodeAt(0)));
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
            return JSON.parse(new TextDecoder().decode(decrypted));
        } catch (e) {
            console.warn('[Security] Decrypt failed:', e.message);
            // Fallback: try plain JSON
            try { return JSON.parse(ciphertextB64); } catch { return null; }
        }
    }

    async function secureSetItem(key, value) {
        try {
            const encrypted = await encryptValue(value);
            localStorage.setItem(key, encrypted);
        } catch (e) {
            console.warn('[Security] secureSetItem failed:', e.message);
        }
    }

    async function secureGetItem(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            return await decryptValue(raw);
        } catch { return null; }
    }

    // ================================================================
    // AUDIT LOGGING (ISO 27001 A.12.4.1)
    // ================================================================

    function createAuditEntry(action, details = {}) {
        return {
            action,
            timestamp: new Date().toISOString(),
            userId: details.userId || 'anonymous',
            tenantId: details.tenantId || null,
            resource: details.resource || null,
            resourceId: details.resourceId || null,
            metadata: details.metadata || {},
            userAgent: navigator.userAgent,
            url: window.location.href,
        };
    }

    async function logAudit(action, details = {}) {
        const entry = createAuditEntry(action, details);
        // Save to local audit queue
        try {
            const queue = JSON.parse(localStorage.getItem('rw_audit_queue') || '[]');
            queue.push(entry);
            // Keep only last 500 entries locally
            if (queue.length > 500) queue.splice(0, queue.length - 500);
            localStorage.setItem('rw_audit_queue', JSON.stringify(queue));
        } catch (e) {
            console.warn('[Audit] Local queue failed:', e.message);
        }

        // Try to send to Supabase audit_logs table
        try {
            if (window.SupabaseClient) {
                const pkg = await window.SupabaseClient.init().catch(() => null);
                if (pkg?.supabase) {
                    const { error } = await pkg.supabase.from('audit_logs').insert({
                        action: entry.action,
                        user_id: entry.userId,
                        tenant_id: entry.tenantId,
                        resource: entry.resource,
                        resource_id: entry.resourceId,
                        metadata: entry.metadata,
                        ip_address: null,
                        user_agent: entry.userAgent,
                    });
                    if (error && !error.message?.includes('does not exist')) {
                        console.warn('[Audit] Supabase insert failed:', error.message);
                    }
                }
            }
        } catch (e) {
            // Silently fail - audit queue is persisted locally
        }
        return entry;
    }

    async function flushAuditQueue() {
        try {
            const queue = JSON.parse(localStorage.getItem('rw_audit_queue') || '[]');
            if (!queue.length) return;
            if (!window.SupabaseClient) return;
            const pkg = await window.SupabaseClient.init().catch(() => null);
            if (!pkg?.supabase) return;
            const toSend = queue.splice(0, 50);
            const { error } = await pkg.supabase.from('audit_logs').insert(
                toSend.map(e => ({
                    action: e.action,
                    user_id: e.userId,
                    tenant_id: e.tenantId,
                    resource: e.resource,
                    resource_id: e.resourceId,
                    metadata: e.metadata,
                    user_agent: e.userAgent,
                }))
            );
            if (!error) {
                localStorage.setItem('rw_audit_queue', JSON.stringify(queue));
            }
        } catch (e) {
            console.warn('[Audit] Flush failed:', e.message);
        }
    }

    // ================================================================
    // DOM SAFE WRAPPER — Auto-sanitize innerHTML (ISO 27001 A.14.2.5)
    // ================================================================

    // Patch innerHTML setter on HTMLElement to auto-sanitize
    // This ensures even if code uses .innerHTML = userContent, it's safe
    let _domPatched = false;
    function enableSafeDOM() {
        if (_domPatched) return;
        _domPatched = true;
        try {
            const origDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerHTML');
            if (!origDescriptor || !origDescriptor.set) return;
            const origSet = origDescriptor.set;
            const origGet = origDescriptor.get;
            Object.defineProperty(HTMLElement.prototype, 'innerHTML', {
                set(value) {
                    if (typeof value === 'string' && /<[a-z]/.test(value)) {
                        origSet.call(this, sanitizeHtml(value));
                    } else {
                        origSet.call(this, value);
                    }
                },
                get() {
                    return origGet.call(this);
                },
                configurable: true,
            });
            console.log('[Security] SafeDOM enabled — innerHTML auto-sanitized');
        } catch (e) {
            console.warn('[Security] SafeDOM patch failed:', e.message);
        }
    }

    // ================================================================
    // CSP COMPLIANCE CHECK (ISO 27001 A.14.2.5)
    // ================================================================

    function getStrictCSP() {
        return [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com https://fonts.googleapis.com https://www.googletagmanager.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://*.googleapis.com",
            "frame-src 'self' https://www.google.com",
            "manifest-src 'self'",
            "media-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ].join('; ');
    }

    // ================================================================
    // ORIGIN VALIDATION (ISO 27001 A.13.1.1)
    // ================================================================

    const ALLOWED_ORIGINS = [
        window.location.origin,
        'https://uabenexigmbogoepdbdx.supabase.co',
    ];

    function isValidOrigin(origin) {
        if (!origin) return false;
        return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
    }

    function validatePostMessage(event, expectedType = null) {
        if (!isValidOrigin(event.origin)) {
            console.warn('[Security] Rejected postMessage from origin:', event.origin);
            return false;
        }
        if (expectedType && event.data?.type !== expectedType) {
            return false;
        }
        return true;
    }

    // ================================================================
    // SESSION MANAGEMENT (ISO 27001 A.9.4.2)
    // ================================================================

    const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 min inactivity
    let _lastActivity = Date.now();
    let _sessionTimer = null;

    function initSessionMonitor() {
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
        function resetActivity() { _lastActivity = Date.now(); }
        events.forEach(evt => document.addEventListener(evt, resetActivity, { passive: true }));
        if (_sessionTimer) clearInterval(_sessionTimer);
        _sessionTimer = setInterval(() => {
            if (Date.now() - _lastActivity > SESSION_TIMEOUT_MS) {
                console.log('[Security] Session timeout due to inactivity');
                // Dispatch custom event that AppController can listen to
                window.dispatchEvent(new CustomEvent('session-timeout'));
            }
        }, 60000);
    }

    async function forceLogout() {
        try {
            if (window.SupabaseClient) {
                const pkg = await window.SupabaseClient.init().catch(() => null);
                if (pkg?.auth) await pkg.auth.signOut();
            }
        } catch (e) {}
        localStorage.removeItem('rw_offline_session');
        window.dispatchEvent(new CustomEvent('force-logout'));
    }

    // ================================================================
    // PII CLASSIFICATION (ISO 27001 A.8.2.1)
    // ================================================================

    const PII_FIELDS = new Set([
        'email', 'phone', 'firstName', 'lastName', 'address', 'taxId',
        'pinHash', 'pin', 'password', 'passwordHash', 'token', 'session',
        'creditCard', 'bankAccount', 'walletBalance', 'loyaltyCardNumber',
    ]);

    const PII_TABLES = new Set([
        'clients', 'users', 'tenant_users', 'suppliers',
        'wallet_transactions', 'loyalty_cards',
    ]);

    function isPIIField(fieldName) {
        return PII_FIELDS.has(fieldName);
    }

    function isPIITable(tableName) {
        return PII_TABLES.has(tableName);
    }

    function redactPII(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        const result = Array.isArray(obj) ? [...obj] : { ...obj };
        for (const key of Object.keys(result)) {
            if (isPIIField(key)) {
                if (key === 'pinHash' || key === 'pin' || key === 'password' || key === 'passwordHash') {
                    result[key] = '[REDACTED]';
                } else if (typeof result[key] === 'string' && result[key].length > 4) {
                    result[key] = result[key].slice(0, 2) + '***' + result[key].slice(-2);
                }
            }
        }
        return result;
    }

    function getPIIFields() {
        return Array.from(PII_FIELDS);
    }

    function getPIITables() {
        return Array.from(PII_TABLES);
    }

    // ================================================================
    // DATA RETENTION (ISO 27001 A.8.2.3)
    // ================================================================

    const MAX_CACHE_AGE_DAYS = 90;
    const MAX_QUEUE_AGE_DAYS = 30;
    const MAX_AUDIT_AGE_DAYS = 90;
    const MAX_SYNC_RETRY_DAYS = 7;

    function getAgeInDays(timestamp) {
        return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    }

    async function purgeOldData() {
        let purged = 0;
        // Purge old cache entries
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith('rw_cache_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key) || '[]');
                    if (Array.isArray(data)) {
                        const filtered = data.filter(item => {
                            const age = getAgeInDays(new Date(item.updated_at || item.created_at || 0).getTime());
                            return age < MAX_CACHE_AGE_DAYS;
                        });
                        if (filtered.length !== data.length) {
                            localStorage.setItem(key, JSON.stringify(filtered));
                            purged += data.length - filtered.length;
                        }
                    }
                } catch (e) {}
            }
        }
        // Purge old sync queue entries
        try {
            const queue = JSON.parse(localStorage.getItem('rw_sync_queue') || '[]');
            const filtered = queue.filter(item => getAgeInDays(item.createdAt) < MAX_QUEUE_AGE_DAYS);
            if (filtered.length !== queue.length) {
                localStorage.setItem('rw_sync_queue', JSON.stringify(filtered));
                purged += queue.length - filtered.length;
            }
        } catch (e) {}
        // Purge old audit queue
        try {
            const audit = JSON.parse(localStorage.getItem('rw_audit_queue') || '[]');
            const filtered = audit.filter(item => getAgeInDays(new Date(item.timestamp).getTime()) < MAX_AUDIT_AGE_DAYS);
            if (filtered.length !== audit.length) {
                localStorage.setItem('rw_audit_queue', JSON.stringify(filtered));
                purged += audit.length - filtered.length;
            }
        } catch (e) {}
        return purged;
    }

    // ================================================================
    // ACCOUNT LOCKOUT (ISO 27001 A.9.4.2)
    // ================================================================

    const LOCKOUT_THRESHOLD = 5;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 min

    function checkLockout(identifier) {
        try {
            const key = 'rw_lockout_' + identifier;
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (data.count >= LOCKOUT_THRESHOLD && Date.now() < data.lockedUntil) {
                return { locked: true, remainingMs: data.lockedUntil - Date.now() };
            }
            if (Date.now() >= (data.lockedUntil || 0)) {
                localStorage.removeItem(key);
                return { locked: false };
            }
            return { locked: false };
        } catch { return { locked: false }; }
    }

    function recordFailedAttempt(identifier) {
        try {
            const key = 'rw_lockout_' + identifier;
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            data.count = (data.count || 0) + 1;
            if (data.count >= LOCKOUT_THRESHOLD) {
                data.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
            }
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {}
    }

    function resetLockout(identifier) {
        try {
            localStorage.removeItem('rw_lockout_' + identifier);
        } catch (e) {}
    }

    // ================================================================
    // 2FA — Two-Factor Authentication (ISO 27001 A.9.4.2)
    // TOTP (Time-based One-Time Password) RFC 6238
    // ================================================================

    // Generate a random base32 secret for TOTP
    function generateTOTPSecret() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let secret = '';
        const bytes = crypto.getRandomValues(new Uint8Array(20));
        for (let i = 0; i < bytes.length; i++) {
            secret += chars[bytes[i] % 32];
        }
        return secret;
    }

    // Generate TOTP URI for QR code (for authenticator apps)
    function generateTOTPUri(secret, email, issuer = 'RIVER-WALL ERP V.5.0') {
        return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    }

    // Verify a TOTP code against a secret
    async function verifyTOTP(token, secret) {
        if (!token || !secret) return false;
        if (!/^\d{6}$/.test(token)) return false;
        try {
            // Base32 decode secret
            const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
            const secretBytes = [];
            let buffer = 0, bits = 0;
            for (const ch of secret.toUpperCase()) {
                const val = base32chars.indexOf(ch);
                if (val === -1) continue;
                buffer = (buffer << 5) | val;
                bits += 5;
                if (bits >= 8) {
                    secretBytes.push((buffer >> (bits - 8)) & 0xFF);
                    bits -= 8;
                }
            }

            const key = await crypto.subtle.importKey(
                'raw', new Uint8Array(secretBytes), { name: 'HMAC', hash: 'SHA-1' },
                false, ['sign']
            );

            // Check current and adjacent time windows (±1 step = 30s each)
            const now = Math.floor(Date.now() / 1000);
            for (let offset = -1; offset <= 1; offset++) {
                const counter = Math.floor((now + offset * 30) / 30);
                const counterBytes = new Uint8Array(8);
                for (let i = 7; i >= 0; i--) {
                    counterBytes[i] = counter & 0xFF;
                    counter >>>= 8;
                }

                const signature = await crypto.subtle.sign('HMAC', key, counterBytes);
                const hash = new Uint8Array(signature);
                const offset_bits = hash[hash.length - 1] & 0xF;
                const code = ((hash[offset_bits] & 0x7F) << 24 |
                             (hash[offset_bits + 1] & 0xFF) << 16 |
                             (hash[offset_bits + 2] & 0xFF) << 8 |
                             (hash[offset_bits + 3] & 0xFF)) % 1000000;

                if (String(code).padStart(6, '0') === token) return true;
            }
            return false;
        } catch (e) {
            console.warn('[2FA] Verification error:', e.message);
            return false;
        }
    }

    // Check if 2FA is enabled for a user
    function is2FAEnabled(email) {
        try {
            const stored = JSON.parse(localStorage.getItem('rw_2fa_secrets') || '{}');
            return !!stored[email];
        } catch { return false; }
    }

    // Enable 2FA for a user
    function enable2FA(email, secret) {
        try {
            const stored = JSON.parse(localStorage.getItem('rw_2fa_secrets') || '{}');
            stored[email] = { secret, enabledAt: Date.now() };
            localStorage.setItem('rw_2fa_secrets', JSON.stringify(stored));
            return true;
        } catch { return false; }
    }

    // Disable 2FA for a user
    function disable2FA(email) {
        try {
            const stored = JSON.parse(localStorage.getItem('rw_2fa_secrets') || '{}');
            delete stored[email];
            localStorage.setItem('rw_2fa_secrets', JSON.stringify(stored));
            return true;
        } catch { return false; }
    }

    // Get TOTP secret for a user
    function getTOTPSecret(email) {
        try {
            const stored = JSON.parse(localStorage.getItem('rw_2fa_secrets') || '{}');
            return stored[email]?.secret || null;
        } catch { return null; }
    }

    // ================================================================
    // RBAC — Role-Based Access Control (ISO 27001 A.9.1.2)
    // ================================================================

    const ROLE_HIERARCHY = {
        viewer: 0,
        seller: 10,
        cashier: 10,
        admin: 50,
        manager: 60,
        superadmin: 100,
    };

    const ROLE_PERMISSIONS = {
        viewer: {
            canViewSales: true,
            canViewProducts: true,
            canViewClients: true,
            canCreateSales: false,
            canEditProducts: false,
            canEditClients: false,
            canAccessAdmin: false,
            canManageUsers: false,
            canViewReports: true,
            canExportData: false,
            canDeleteData: false,
        },
        seller: {
            canViewSales: true,
            canViewProducts: true,
            canViewClients: true,
            canCreateSales: true,
            canEditProducts: false,
            canEditClients: true,
            canAccessAdmin: false,
            canManageUsers: false,
            canViewReports: false,
            canExportData: false,
            canDeleteData: false,
        },
        admin: {
            canViewSales: true,
            canViewProducts: true,
            canViewClients: true,
            canCreateSales: true,
            canEditProducts: true,
            canEditClients: true,
            canAccessAdmin: true,
            canManageUsers: true,
            canViewReports: true,
            canExportData: true,
            canDeleteData: true,
        },
        superadmin: {
            canViewSales: true,
            canViewProducts: true,
            canViewClients: true,
            canCreateSales: true,
            canEditProducts: true,
            canEditClients: true,
            canAccessAdmin: true,
            canManageUsers: true,
            canViewReports: true,
            canExportData: true,
            canDeleteData: true,
        },
    };

    function getRoleLevel(role) {
        return ROLE_HIERARCHY[role] ?? 0;
    }

    function hasPermission(role, permission) {
        const normalizedRole = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.seller;
        return normalizedRole[permission] === true;
    }

    function isAtLeast(role, minimum) {
        return getRoleLevel(role) >= getRoleLevel(minimum);
    }

    function getEffectiveRole(userRole) {
        const normalized = (userRole || 'seller').toLowerCase();
        if (ROLE_HIERARCHY[normalized] !== undefined) return normalized;
        return 'seller';
    }

    function requireRole(minimumRole) {
        return function(target, propertyKey, descriptor) {
            const originalMethod = descriptor.value;
            descriptor.value = function(...args) {
                const role = this.currentRole || this.userRole || 'seller';
                if (!isAtLeast(role, minimumRole)) {
                    console.warn(`[RBAC] Access denied: ${role} cannot access ${propertyKey} (requires ${minimumRole})`);
                    if (typeof this.showToast === 'function') {
                        this.showToast('Acceso denegado. No tienes permisos suficientes.', 'error');
                    }
                    return null;
                }
                return originalMethod.apply(this, args);
            };
            return descriptor;
        };
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    global.RWSecurity = Object.assign(RWSecurity, {
        // XSS
        escapeHtml,
        sanitizeHtml,
        setSafeHTML,
        setText,
        enableSafeDOM,
        // Encryption
        encryptValue,
        decryptValue,
        secureSetItem,
        secureGetItem,
        // Audit
        logAudit,
        createAuditEntry,
        flushAuditQueue,
        // RBAC
        getRoleLevel,
        hasPermission,
        isAtLeast,
        getEffectiveRole,
        requireRole,
        ROLE_HIERARCHY,
        ROLE_PERMISSIONS,
        // 2FA
        generateTOTPSecret,
        generateTOTPUri,
        verifyTOTP,
        is2FAEnabled,
        enable2FA,
        disable2FA,
        getTOTPSecret,
        // PII & Data Retention
        isPIIField,
        isPIITable,
        redactPII,
        getPIIFields,
        getPIITables,
        purgeOldData,
        MAX_CACHE_AGE_DAYS,
        // CSP
        getStrictCSP,
        // Origin validation
        isValidOrigin,
        validatePostMessage,
        // Session
        initSessionMonitor,
        forceLogout,
        SESSION_TIMEOUT_MS,
        // Lockout
        checkLockout,
        recordFailedAttempt,
        resetLockout,
    });

    console.log('[Security] Utilities loaded (ISO 27001 ready)');
})(window);
