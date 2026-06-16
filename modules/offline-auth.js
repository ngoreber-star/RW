        var OfflineAuth = {
            CREDENTIALS_KEY: 'rw_offline_credentials',
            SESSION_KEY: 'rw_offline_session',
            PIN_KEY: 'rw_recovery_pin',
            TENANT_KEY: 'rw_offline_tenant',
            LICENSE_KEY: 'rw_offline_license',

            _generateSalt() {
                const arr = new Uint8Array(16);
                crypto.getRandomValues(arr);
                return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
            },

            async _deriveKey(password, salt, iterations = 100000) {
                const encoder = new TextEncoder();
                const keyMaterial = await crypto.subtle.importKey(
                    'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
                );
                const derived = await crypto.subtle.deriveBits(
                    { name: 'PBKDF2', salt: encoder.encode(salt), iterations, hash: 'SHA-256' },
                    keyMaterial, 256
                );
                return Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('');
            },

            async hashPassword(password, salt) {
                salt = salt || this._generateSalt();
                const hash = await this._deriveKey(password, salt);
                return { salt, hash };
            },

            async verifyCredentials(email, password) {
                const stored = JSON.parse(localStorage.getItem(this.CREDENTIALS_KEY) || 'null');
                if (!stored) return false;
                if (stored.email !== email) return false;
                // Legacy SHA-256 without salt migration
                if (stored.isSha256 && !stored.pbkdf2Salt) {
                    console.warn('[OfflineAuth] Migrating legacy SHA-256 credential to PBKDF2');
                    await this.saveCredentials(email, password, stored.userData);
                    const migrated = JSON.parse(localStorage.getItem(this.CREDENTIALS_KEY) || 'null');
                    return migrated ? (migrated.userData || null) : false;
                }
                // Legacy plain text is no longer supported — force re-login
                if (!stored.pbkdf2Salt) {
                    console.warn('[OfflineAuth] Legacy plain text credential rejected. Please login online.');
                    return false;
                }
                const inputHash = await this._deriveKey(password, stored.pbkdf2Salt, stored.pbkdf2Iterations || 100000);
                if (inputHash !== stored.passwordHash) return false;
                return stored.userData || null;
            },

            async saveCredentials(email, password, userData) {
                const { salt, hash } = await this.hashPassword(password);
                const payload = {
                    email,
                    passwordHash: hash,
                    pbkdf2Salt: salt,
                    pbkdf2Iterations: 100000,
                    userData: {
                        uid: userData.uid || userData.id,
                        email: userData.email,
                        displayName: userData.displayName || userData.display_name || userData.email?.split('@')[0] || ''
                    }
                };
                localStorage.setItem(this.CREDENTIALS_KEY, JSON.stringify(payload));
            },

            saveSession(userData, ttlDays = 30) {
                const session = {
                    uid: userData.uid || userData.id,
                    email: userData.email,
                    displayName: userData.displayName || userData.display_name || userData.email?.split('@')[0] || '',
                    expiresAt: Date.now() + (ttlDays * 86400000)
                };
                localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
            },

            getSession() {
                try {
                    const session = JSON.parse(localStorage.getItem(this.SESSION_KEY) || 'null');
                    if (!session) return null;
                    if (Date.now() > session.expiresAt) {
                        localStorage.removeItem(this.SESSION_KEY);
                        return null;
                    }
                    return session;
                } catch (e) { return null; }
            },

            clearSession() {
                localStorage.removeItem(this.SESSION_KEY);
                localStorage.removeItem(this.CREDENTIALS_KEY);
                localStorage.removeItem(this.TENANT_KEY);
                localStorage.removeItem(this.LICENSE_KEY);
            },

            logout() {
                this.clearSession();
            },

            hasCredentials() {
                return !!localStorage.getItem(this.CREDENTIALS_KEY);
            },

            isSessionValid() {
                return this.getSession() !== null;
            },

            saveTenantSnapshot(tenant) {
                if (!tenant) return;
                localStorage.setItem(this.TENANT_KEY, JSON.stringify(tenant));
            },

            getTenantSnapshot() {
                try {
                    return JSON.parse(localStorage.getItem(this.TENANT_KEY) || 'null');
                } catch (e) { return null; }
            },

            saveLicenseSnapshot(license) {
                if (!license) return;
                localStorage.setItem(this.LICENSE_KEY, JSON.stringify(license));
            },

            getLicenseSnapshot() {
                try {
                    return JSON.parse(localStorage.getItem(this.LICENSE_KEY) || 'null');
                } catch (e) { return null; }
            },

            async generateRecoveryCode() {
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                const { salt, hash } = await this.hashPassword(code);
                return { code, hash, salt };
            },

            async verifyRecoveryCode(code) {
                const stored = JSON.parse(localStorage.getItem(this.PIN_KEY) || 'null');
                if (!stored) return false;
                // Legacy migration
                if (stored.hash && !stored.salt) {
                    console.warn('[OfflineAuth] Legacy recovery PIN, please regenerate.');
                    return false;
                }
                const inputHash = await this._deriveKey(code, stored.salt, stored.iterations || 100000);
                return inputHash === stored.hash;
            },

            async saveRecoveryPin(pin) {
                const { salt, hash } = await this.hashPassword(pin);
                localStorage.setItem(this.PIN_KEY, JSON.stringify({ hash, salt, iterations: 100000 }));
            },

            getCredentials() {
                const stored = JSON.parse(localStorage.getItem(this.CREDENTIALS_KEY) || 'null');
                if (!stored) return null;
                return { email: stored.email };
            }
        };
        window.OfflineAuth = OfflineAuth;
