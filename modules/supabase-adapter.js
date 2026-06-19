/**
 * RIVER-WALL ERP V.5.0 - Supabase Auth Adapter
 *
 * This adapter only patches AppController login/session/logout behaviour so
 * the legacy Firebase-style auth flow in software.html continues to work with
 * Supabase.  modules/data-store.js already delegates directly to
 * SupabaseDataStore, so no DataStore patches are required here.
 */

(function (global) {
    'use strict';
    if (global.__SUPABASE_AUTH_ADAPTER_LOADED__) return;
    global.__SUPABASE_AUTH_ADAPTER_LOADED__ = true;

    const supabasePkg = global.SupabaseClient;
    if (!supabasePkg) {
        console.error('[SupabaseAuthAdapter] SupabaseClient not found');
        return;
    }

    let _initPromise = null;
    let _client = null;

    async function getSupabase() {
        if (_client) return _client;
        if (!_initPromise) {
            _initPromise = supabasePkg.init().catch(err => {
                _initPromise = null;
                throw err;
            });
        }
        _client = await _initPromise;
        return _client;
    }

    function patchAppController() {
        const AC = global.AppController;
        if (!AC) {
            console.error('[SupabaseAuthAdapter] AppController not found');
            return;
        }

        const origInitializeApp = AC.initializeApp;

        // ------------------------------------------------------------------
        // 1. Tenant resolution: use Supabase tenant tables instead of Firestore
        // ------------------------------------------------------------------
        AC.resolveTenantContext = async function (user) {
            const fallback = { id: 'default', profile: null, role: 'cashier', sharedStoreId: 'default', localIds: [], allLocals: false };
            if (!user?.id) return fallback;
            try {
                const { auth } = await getSupabase();
                const tenant = await auth.resolveTenant(user.id);
                if (tenant) {
                    return {
                        id: tenant.id,
                        profile: tenant,
                        role: tenant.role || 'cashier',
                        sharedStoreId: tenant.id,
                        localIds: Array.isArray(tenant.localIds) ? tenant.localIds : [],
                        allLocals: tenant.role === 'admin' || tenant.role === 'manager' || tenant.allLocals === true
                    };
                }
            } catch (err) {
                console.warn('[SupabaseAuthAdapter] resolveTenantContext failed:', err);
            }
            return fallback;
        };

        // ------------------------------------------------------------------
        // 2. Replace AppController.init: Supabase session check instead of Firebase onAuthStateChanged
        // ------------------------------------------------------------------
        AC.init = async function () {
            AC.registerServiceWorker();
            const splashPromise = AC.animateSplash();

            // Safety timeout: prevent infinite splash, but do not reload to avoid loops
            AC.initTimeout = setTimeout(() => {
                if (!AC.initCompleted) {
                    console.warn('[AppController] Init timeout — stopping auto-reload to prevent loop');
                    AC.initCompleted = true;
                }
            }, 15000);

            AC.setupEventListeners();

            try {
                console.log('[SupabaseAuthAdapter] AppController.init starting...');
                const { supabase: sb, auth } = await getSupabase();
                console.log('[SupabaseAuthAdapter] Supabase ready, checking session...');
                const { data: { session } } = await sb.auth.getSession();
                console.log('[SupabaseAuthAdapter] Session:', session ? 'found' : 'none');

                AC.initCompleted = true;
                if (AC.initTimeout) { clearTimeout(AC.initTimeout); AC.initTimeout = null; }
                await splashPromise;

                if (session?.user) {
                    auth.currentUser = session.user;
                    const tenant = await auth.resolveTenant(session.user.id);
                    console.log('[SupabaseAuthAdapter] Tenant resolved:', tenant ? tenant.id : 'null');

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
                        console.warn('[SupabaseAuthAdapter] No tenant for user, showing login');
                        AC.showLoginScreen();
                        setTimeout(() => {
                            if (typeof ui !== 'undefined' && ui.showToast) {
                                ui.showToast('Su usuario no está vinculado a ningún negocio. Contacte al administrador.', 'error', 6000);
                            }
                        }, 800);
                    }
                } else {
                    console.log('[SupabaseAuthAdapter] No session, showing login');
                    AC.showLoginScreen();
                }
            } catch (err) {
                console.error('[SupabaseAuthAdapter] AppController.init error:', err);
                AC.initCompleted = true;
                if (AC.initTimeout) { clearTimeout(AC.initTimeout); AC.initTimeout = null; }
                AC.showLoginScreen();
            }
        };

        // ------------------------------------------------------------------
        // 3. Login screen: wire form/button to Supabase
        // ------------------------------------------------------------------
        AC.showLoginScreen = function () {
            const loginScreen = document.getElementById('loginScreen');
            const splash = document.getElementById('splashScreen');
            if (splash) splash.style.opacity = '0';
            setTimeout(() => {
                if (splash) splash.classList.add('hidden');
                if (loginScreen) {
                    loginScreen.classList.remove('hidden');
                    setTimeout(() => { loginScreen.style.opacity = '1'; }, 50);
                }
            }, 500);

            AC.initCompleted = true;
            if (AC.initTimeout) { clearTimeout(AC.initTimeout); AC.initTimeout = null; }

            const submitLogin = () => {
                const email = String(document.getElementById('loginEmail')?.value || '').trim();
                const password = String(document.getElementById('loginPassword')?.value || '').trim();
                if (email && password) {
                    AC._handleSupabaseLogin(email, password);
                } else {
                    if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Ingrese email y contraseña', 'error');
                }
            };

            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.onsubmit = (e) => { e.preventDefault(); submitLogin(); };
            }

            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) {
                const newBtn = loginBtn.cloneNode(true);
                loginBtn.parentNode.replaceChild(newBtn, loginBtn);
                newBtn.addEventListener('click', (e) => { e.preventDefault(); submitLogin(); });
            }

            const togglePassword = document.getElementById('togglePassword');
            if (togglePassword) {
                togglePassword.onclick = () => {
                    const input = document.getElementById('loginPassword');
                    const icon = togglePassword.querySelector('i');
                    if (!input || !icon) return;
                    input.type = input.type === 'password' ? 'text' : 'password';
                    icon.className = input.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
                };
            }
        };

        // ------------------------------------------------------------------
        // 4. Logout
        // ------------------------------------------------------------------
        AC.completeLogout = async function () {
            if (global.store && global.store.disconnectCloud) global.store.disconnectCloud();
            AC.setLoginTarget('dashboard');
            try {
                const { supabase: sb } = await getSupabase();
                await sb.auth.signOut();
            } catch (e) { /* ignore */ }
            if (global.OfflineAuth) {
                if (global.OfflineAuth.logout) global.OfflineAuth.logout();
                else global.OfflineAuth.clearSession();
            }
            global.AppState.offlineMode = false;
            global.AppState.demoMode = false;
            global.AppState.user = null;
            localStorage.removeItem('rw_tenant_id');
            location.reload();
        };

        // ------------------------------------------------------------------
        // 5. Password reset
        // ------------------------------------------------------------------
        AC.showPasswordReset = async function () {
            const email = document.getElementById('loginEmail')?.value;
            if (!email) {
                if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Ingrese su email', 'warning');
                return;
            }
            try {
                const { supabase: sb } = await getSupabase();
                const { error } = await sb.auth.resetPasswordForEmail(email);
                if (error) throw error;
                if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Email de recuperación enviado', 'success');
            } catch (error) {
                if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Error: ' + error.message, 'error');
            }
        };

        // ------------------------------------------------------------------
        // 6. Google login
        // ------------------------------------------------------------------
        AC.loginWithGoogle = async function () {
            try {
                const { supabase: sb } = await getSupabase();
                const { error } = await sb.auth.signInWithOAuth({ provider: 'google' });
                if (error) throw error;
            } catch (error) {
                if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Error: ' + error.message, 'error');
            }
        };

        // ------------------------------------------------------------------
        // 7. Core login handler
        // ------------------------------------------------------------------
        AC._handleSupabaseLogin = async function (email, password) {
            const btn = document.getElementById('loginBtn');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...'; }

            try {
                const { auth } = await getSupabase();
                const result = await auth.signIn(email, password);

                // Offline fallback returns { session, offline: true }
                if (result?.offline && result?.session) {
                    const offlineUser = {
                        uid: result.session.uid,
                        id: result.session.uid,
                        email: result.session.email,
                        displayName: result.session.displayName,
                        emailVerified: true
                    };
                    global.AppState.offlineMode = true;
                    global.AppState.user = offlineUser;
                    await origInitializeApp.call(AC, offlineUser);
                    return;
                }

                if (result?.error) throw result.error;

                const user = result?.user;
                const tenant = result?.tenant;
                if (user && tenant) {
                    global.AppState.user = user;
                    global.AppState.tenant = tenant;
                    localStorage.setItem('rw_tenant_id', tenant.id || tenant.tenantId || 'default');
                    if (global.OfflineAuth && global.OfflineAuth.saveTenantSnapshot) {
                        global.OfflineAuth.saveTenantSnapshot(tenant);
                    }
                    await origInitializeApp.call(AC, user);
                } else {
                    if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Credenciales incorrectas', 'error');
                }
            } catch (err) {
                console.error('[SupabaseAuthAdapter] Login error:', err);
                const msg = err?.message || 'Error de autenticación';
                if (typeof ui !== 'undefined' && ui.showToast) ui.showToast(msg, 'error');
                else alert(msg);
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = '<span data-i18n="login.signIn">Entrar</span><i class="fas fa-arrow-right"></i>'; }
            }
        };

        // ------------------------------------------------------------------
        // 8. POS quick-access login
        // ------------------------------------------------------------------
        AC.submitPOSAccessLogin = async function () {
            const email = String(document.getElementById('posAccessEmail')?.value || '').trim();
            const password = String(document.getElementById('posAccessPassword')?.value || '').trim();
            const btn = document.getElementById('posAccessBtn');

            if (!email || !password) {
                if (typeof ui !== 'undefined' && ui.showToast) ui.showToast('Ingrese email y contraseña para entrar al POS', 'warning');
                return;
            }

            const loginEmail = document.getElementById('loginEmail');
            const loginPassword = document.getElementById('loginPassword');
            if (loginEmail) loginEmail.value = email;
            if (loginPassword) loginPassword.value = password;

            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Entrando...'; }

            try {
                AC.setLoginTarget('pos');
                await AC._handleSupabaseLogin(email, password);
                if (typeof ui !== 'undefined' && ui.closeModal) ui.closeModal();
            } catch (err) {
                console.error('[SupabaseAuthAdapter] POS login error:', err);
                const msg = err?.message || 'Error de autenticación';
                if (typeof ui !== 'undefined' && ui.showToast) ui.showToast(msg, 'error');
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-store mr-2"></i>Entrar al POS'; }
            }
        };
    }

    // ---------------------------------------------------------------------
    // Boot: patch AppController immediately so the bootstrap call uses the
    // Supabase-aware versions.
    // ---------------------------------------------------------------------
    if (typeof global.AppController !== 'undefined') {
        patchAppController();
        console.log('[SupabaseAuthAdapter] ✅ AppController auth patches applied');
    } else {
        console.error('[SupabaseAuthAdapter] AppController not available; cannot patch login flow');
    }
})(window);
