        class AppController {
            static initTimeout = null;
            static initCompleted = false;

            static async init() {
                AppController.registerServiceWorker();

                const splashPromise = AppController.animateSplash();
                let bootstrapped = false;

                // Set a safety timeout - if auth state doesn't trigger within 8 seconds, reload
                AppController.initTimeout = setTimeout(() => {
                    if (!AppController.initCompleted) {
                        console.warn('[AppController] Initialization timeout - reloading page');
                        // Clear service worker cache and reload
                        if ('caches' in window) {
                            caches.keys().then(names => {
                                names.forEach(name => caches.delete(name));
                            }).finally(() => {
                                window.location.reload();
                            });
                        } else {
                            window.location.reload();
                        }
                    }
                }, 8000);

                onAuthStateChanged(auth, async (user) => {
                    AppController.initCompleted = true;
                    if (AppController.initTimeout) {
                        clearTimeout(AppController.initTimeout);
                        AppController.initTimeout = null;
                    }

                    if (!bootstrapped) {
                        await splashPromise;
                        bootstrapped = true;
                    }

                    if (user) {
                        let activeUser = user;
                        try {
                            await user.reload();
                            activeUser = auth.currentUser || user;
                        } catch (refreshError) {
                            console.warn('No se pudo refrescar la sesión actual:', refreshError?.message || refreshError);
                        }
                        AppState.offlineMode = false;
                        await AppController.initializeApp(activeUser);
                    } else if (!AppState.demoMode) {
                        // Intentar restaurar sesión offline antes de mostrar login
                        const offlineSession = OfflineAuth.getSession();
                        if (offlineSession && !navigator.onLine) {
                            console.log('[Auth] Restaurando sesión offline...');
                            const offlineUser = {
                                uid: offlineSession.uid,
                                email: offlineSession.email,
                                displayName: offlineSession.displayName,
                                emailVerified: true
                            };
                            AppState.offlineMode = true;
                            await AppController.initializeApp(offlineUser);
                            return;
                        }
                        store.disconnectCloud();
                        AppController.showLoginScreen();
                    }
                });
                
                AppController.setupEventListeners();
            }

            static registerServiceWorker() {
                if (!('serviceWorker' in navigator)) return;
                if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
                window.addEventListener('load', async () => {
                    try {
                        const registration = await navigator.serviceWorker.register('/sw.js');
                        
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            if (!newWorker) return;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('[App] New service worker available, skipping waiting...');
                                    newWorker.postMessage('skipWaiting');
                                }
                            });
                        });
                        
                        let swUpdateHandled = false;
                        navigator.serviceWorker.addEventListener('controllerchange', () => {
                            if (swUpdateHandled) return;
                            swUpdateHandled = true;
                            console.log('[App] Service worker updated, reloading...');
                            window.location.reload();
                        });
                    } catch (error) {
                        console.warn('Service worker registration failed:', error);
                    }
                });
            }

            static async animateSplash() {
                const progress = document.getElementById('splashProgress');
                const status = document.getElementById('splashStatus');
                if (!progress || !status) return;

                const steps = [
                    { pct: 25, text: 'Inicializando sistema...', delay: 800 },
                    { pct: 55, text: 'Cargando interfaz...', delay: 900 },
                    { pct: 80, text: 'Recuperando datos locales...', delay: 800 },
                    { pct: 100, text: 'Listo', delay: 600 }
                ];

                for (let index = 0; index < steps.length; index += 1) {
                    const step = steps[index];
                    progress.style.width = step.pct + '%';
                    status.textContent = step.text;
                    if (step.delay) {
                        await new Promise((resolve) => setTimeout(resolve, step.delay));
                    }
                }
                // Pequeña pausa extra para que el usuario aprecie el splash premium
                await new Promise((resolve) => setTimeout(resolve, 400));
            }

            static async loadTenantLicense(tenantId) {
                if (!tenantId || tenantId === 'default') return;
                try {
                    let lic = null;

                    // Modo offline: intentar usar snapshot guardado
                    if (AppState.offlineMode) {
                        const snapshot = OfflineAuth.getLicenseSnapshot();
                        if (snapshot) {
                            console.log('[License] Usando snapshot offline');
                            const expiryMs = new Date(snapshot.expiryDate).getTime();
                            const daysLeft = Math.max(1, Math.ceil((expiryMs - Date.now()) / 86400000));
                            const token = licenseManager.generateToken({
                                tenant: tenantId,
                                plan: snapshot.plan || 'basic',
                                features: snapshot.plan === 'enterprise' ? ['all'] : ['basic'],
                                days: daysLeft
                            });
                            licenseManager.storeLicense(token);
                            return;
                        }
                        console.warn('[License] No hay snapshot offline en modo offline');
                    }

                    try {
                        // No orderBy — avoids composite index requirement; sort client-side instead
                        const q = query(
                            collection(db, 'rw_superadmin_licenses'),
                            where('tenant', '==', tenantId),
                            where('status', '==', 'active')
                        );
                        const snap = await getDocs(q);

                        if (!snap.empty) {
                            // Pick the license with the furthest expiry date
                            lic = snap.docs
                                .map(d => d.data())
                                .filter(l => l.expiryDate)
                                .sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate))[0] || null;
                        }
                    } catch (licenseQueryError) {
                        console.warn(`No se pudo consultar la licencia activa para ${tenantId}:`, licenseQueryError?.message || licenseQueryError);
                    }

                    if (!lic) {
                        // No license record yet — fall back to tenant profile plan/days
                        const tenantDoc = await getDoc(doc(db, 'rw_superadmin_tenants', tenantId));
                        if (tenantDoc.exists()) {
                            const t = tenantDoc.data();
                            const days = t.licenseDays || 365;
                            lic = {
                                plan: t.plan || 'basic',
                                days,
                                expiryDate: new Date(Date.now() + days * 86400000).toISOString()
                            };
                        }
                    }

                    if (!lic) return;

                    // Guardar snapshot para uso offline
                    OfflineAuth.saveLicenseSnapshot(lic);

                    const expiryMs = new Date(lic.expiryDate).getTime();
                    const daysLeft = Math.max(1, Math.ceil((expiryMs - Date.now()) / 86400000));
                    const token = licenseManager.generateToken({
                        tenant: tenantId,
                        plan: lic.plan || 'basic',
                        features: lic.plan === 'enterprise' ? ['all'] : ['basic'],
                        days: daysLeft
                    });
                    licenseManager.storeLicense(token);
                } catch (e) {
                    console.warn('loadTenantLicense error:', e.message || e);
                }
            }

            static async resolveTenantContext(user) {
                const fallback = { id: 'default', profile: null, role: 'cashier', sharedStoreId: 'default', localIds: [], allLocals: false };
                if (!user?.uid) return fallback;

                // Modo offline: usar snapshot guardado
                if (AppState.offlineMode) {
                    const snapshot = OfflineAuth.getTenantSnapshot();
                    if (snapshot) {
                        console.log('[Tenant] Usando snapshot offline:', snapshot.id);
                        return snapshot;
                    }
                    console.warn('[Tenant] No hay snapshot offline, usando fallback');
                    return fallback;
                }

                let result = fallback;

                try {
                    // Primary path: check rw_superadmin_users for explicit role assignment
                    const userDoc = await getDoc(doc(db, 'rw_superadmin_users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        const tenantId = userData.tenantId || 'default';
                        const role = userData.role === 'admin' ? 'admin' : 'cashier';
                        // Usar tenantId como sharedStoreId por defecto para aislar datos entre tenants
                        const defaultScopeId = tenantId;
                        const sharedStoreIdRaw = String(userData.sharedStoreId || defaultScopeId).trim();
                        const sharedStoreId = /^__.*__$/.test(sharedStoreIdRaw)
                            ? defaultScopeId
                            : (sharedStoreIdRaw.replace(/[^a-zA-Z0-9_-]/g, '_') || defaultScopeId);

                        const localIds = Array.isArray(userData.localIds) ? userData.localIds : [];
                        const allLocals = userData.allLocals === true || role === 'admin';

                        if ((user.email && userData.email !== user.email) || userData.sharedStoreId !== sharedStoreId) {
                            const userUpdates = {
                                updatedAt: serverTimestamp()
                            };
                            if (user.email && userData.email !== user.email) {
                                userUpdates.email = user.email;
                            }
                            if (userData.sharedStoreId !== sharedStoreId) {
                                userUpdates.sharedStoreId = sharedStoreId;
                            }
                            updateDoc(doc(db, 'rw_superadmin_users', user.uid), userUpdates).catch((syncError) => {
                                console.warn('No se pudo sincronizar el perfil del usuario:', syncError);
                            });
                        }
                        
                        try {
                            const tenantDoc = await getDoc(doc(db, 'rw_superadmin_tenants', tenantId));
                            console.log(`Usuario ${user.uid} resuelta: tenantId=${tenantId}, role=${role}`);
                            result = {
                                id: tenantId,
                                profile: tenantDoc.exists() ? tenantDoc.data() : null,
                                role: role,
                                sharedStoreId,
                                localIds: Array.isArray(userData.localIds) ? userData.localIds : [],
                                allLocals: userData.allLocals === true || role === 'admin'
                            };
                        } catch (tenantError) {
                            console.warn(`No se pudo cargar tenant ${tenantId}:`, tenantError);
                            result = { id: tenantId, profile: null, role: role, sharedStoreId, localIds: Array.isArray(userData.localIds) ? userData.localIds : [], allLocals: userData.allLocals === true || role === 'admin' };
                        }
                    } else {
                        // Fallback: user not found in rw_superadmin_users
                        console.warn(`Usuario ${user.uid} (${user.email}) no registrado en rw_superadmin_users`);
                        
                        // Try to find tenant by email, but only for reference (don't auto-promote to admin)
                        try {
                            const tenantQ = query(collection(db, 'rw_superadmin_tenants'), where('email', '==', user.email), limit(1));
                            const tenantSnap = await getDocs(tenantQ);
                            if (!tenantSnap.empty) {
                                const tenantDoc = tenantSnap.docs[0];
                                console.log(`Tenant encontrado por email ${user.email}, ID: ${tenantDoc.id}. Usando rol=cashier por falta de registro en rw_superadmin_users`);
                                // Usar el tenantId como sharedStoreId para aislar datos
                                result = { id: tenantDoc.id, profile: tenantDoc.data(), role: 'cashier', sharedStoreId: tenantDoc.id, localIds: [], allLocals: false };
                            }
                        } catch (e) {
                            console.warn('No se pudo buscar tenant por email:', e);
                        }
                    }
                } catch (error) {
                    console.error('Error resolving tenant:', error?.code || error?.message || error);
                }

                // Guardar snapshot para uso offline
                if (result !== fallback) {
                    OfflineAuth.saveTenantSnapshot(result);
                }

                if (result === fallback) {
                    console.warn(`Usuario ${user?.uid} sin contexto válido, usando fallback con rol=cashier`);
                }

                // Ensure tenant ID consistency with Supabase if a stored ID exists
                const storedSupabaseTenantId = localStorage.getItem('rw_tenant_id');
                if (storedSupabaseTenantId && result && result.id !== storedSupabaseTenantId) {
                    console.log(`[Tenant] Overriding tenant ID from "${result.id}" to stored Supabase ID "${storedSupabaseTenantId}"`);
                    const oldId = result.id;
                    result = { ...result, id: storedSupabaseTenantId };
                    // Keep the fallback path working
                    if (oldId === 'default' || oldId === storedSupabaseTenantId) {
                        // ID changed, but we keep the rest
                    }
                }
                return result;
            }

            static isPosOnlyUser() {
                return (AppState.userRole || 'cashier') !== 'admin';
            }

            static setLoginTarget(target = 'dashboard') {
                const normalizedTarget = target === 'pos' ? 'pos' : 'dashboard';
                AppState.loginTarget = normalizedTarget;
                try {
                    sessionStorage.setItem('rw_login_target', normalizedTarget);
                } catch (error) {
                    console.warn('No se pudo guardar el destino del login:', error);
                }
            }

            static getInitialPageAfterLogin() {
                const pathPage = window.location.pathname.replace(/^\//, '').split('/')[0];
                const allowedPages = ['dashboard','pos','products','categories','clients','invoices','quotes','training','deliveries','reports','settings','profile','inventory','suppliers','warehouses','transfers','expiry-promotions','demand-forecast','users','purchases','cash-register','credits','returns','promotions','audit','backup','help','accounting','locales','multi-local-dashboard'];
                const lastPage = localStorage.getItem('rw_lastPage') || 'dashboard';
                const requestedPage = allowedPages.includes(pathPage) ? pathPage : lastPage;
                if (AppController.isPosOnlyUser()) return 'pos';
                return AppState.loginTarget === 'pos' ? 'pos' : requestedPage;
            }

            static async initializeApp(user) {
                const splashEl = document.getElementById('splashScreen');
                const appLoadingEl = document.getElementById('appLoadingScreen');
                const appEl = document.getElementById('appContainer');
                const loginEl = document.getElementById('loginScreen');
                const startTime = performance.now();

                // Ocultar splash inicial y login, mostrar pantalla de carga post-login
                splashEl.classList.add('hidden');
                loginEl.classList.add('hidden');
                appLoadingEl.classList.remove('hidden');
                
                // Inicializar tips de productividad
                ProductivityTips.startRotation();

                try {
                    AppState.user = user;
                    const tenant = await AppController.resolveTenantContext(user);
                    AppState.tenant = tenant;
                    const role = AppState.tenant?.role;
                    AppState.userRole = (role === 'admin' || role === 'manager' || role === 'superadmin') ? role : 'cashier';

                    // Resolve current local from localStorage fallback (ensureDefaultLocal will run after cloud loads)
                    const defaultLocalId = store.getDefaultLocalId();
                    AppState.currentLocalId = defaultLocalId;
                    
                    // Resolve accessible local for the user
                    const accessibleLocals = store.getAccessibleLocals();
                    const accessibleIds = new Set(accessibleLocals.map(l => l.id));
                    // Block UI only for non-admin users with zero accessible locals.
                    // Admins may have empty local data before cloud loads; ensureDefaultLocal() will create one if needed.
                    if (accessibleIds.size === 0 && AppState.userRole !== 'admin') {
                        appLoadingEl.classList.add('hidden');
                        appEl.innerHTML = `
                            <div class="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-6 text-center">
                                <div class="w-24 h-24 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6">
                                    <i class="fas fa-ban text-4xl text-red-500 dark:text-red-400"></i>
                                </div>
                                <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acceso Bloqueado</h1>
                                <p class="text-gray-600 dark:text-slate-400 max-w-md mb-6">No tienes locales asignados. Contacta al administrador del sistema para que te asigne al menos un local.</p>
                                <button onclick="AppController.logout()" class="px-6 py-2.5 rounded-xl btn-primary-enterprise text-white font-semibold">Cerrar sesión</button>
                            </div>
                        `;
                        appEl.classList.remove('hidden');
                        console.warn('[AppController] User has zero accessible locals; blocking UI.');
                        // Still connect cloud in background so an admin assignment can be picked up on next login
                        store.connectCloud(user, AppState.tenant).catch(() => {});
                        return;
                    } else if (accessibleIds.size === 0 && AppState.userRole === 'admin') {
                        console.log('[AppController] Admin with zero accessible locals before cloud load; allowing init.');
                    } else if (accessibleIds.size === 1) {
                        AppState.currentLocalId = Array.from(accessibleIds)[0];
                    } else if (defaultLocalId && accessibleIds.has(defaultLocalId)) {
                        AppState.currentLocalId = defaultLocalId;
                    } else {
                        AppState.currentLocalId = Array.from(accessibleIds)[0];
                    }

                    // Cargar snapshot local al instante y dejar la nube terminar en segundo plano
                    const cloudConnectionPromise = store.connectCloud(user, AppState.tenant)
                        .catch((cloudError) => {
                            console.warn('La sincronización inicial seguirá en segundo plano:', cloudError?.message || cloudError);
                        });

                    // Preparar UI y licencia sin bloquear la primera pintura
                    await Promise.allSettled([
                        AppController.loadTenantLicense(AppState.tenant?.id || user.uid),
                        Promise.resolve(AppController._prepareUI(user))
                    ]);

                    const removedDemoArtifacts = store.removeDemoArtifacts();
                    if (removedDemoArtifacts) {
                        console.log('Se limpiaron datos demo heredados del negocio actual');
                    }

                    appEl.classList.remove('hidden');

                    const initialPage = AppController.getInitialPageAfterLogin();
                    
                    // Mostrar selector de terminal con datos locales (rápido)
                    await showPosTerminalSelector();
                    
                    ui.navigateTo(initialPage);
                    
                    // Cuando el cloud termine de cargar, mostrar selector si hay múltiples
                    // y el usuario aún tiene la terminal por defecto (no eligió explícitamente)
                    cloudConnectionPromise.then(() => {
                        const terminals = store.get('posTerminals')?.filter(t => t.isActive) || [];
                        const active = store.getActivePosTerminal();
                        const isDefaultTerminal = active?.id === 'pos_default';
                        const activeExistsInList = terminals.some(t => t.id === active?.id);
                        if (terminals.length > 1 && (isDefaultTerminal || !activeExistsInList)) {
                            showPosTerminalSelector();
                        }
                    }).catch(() => {});
                    AppController.setLoginTarget('dashboard');

                    const elapsed = performance.now() - startTime;
                    const minDisplayTime = 120;
                    const remainingTime = Math.max(0, minDisplayTime - elapsed);

                    if (remainingTime > 0) {
                        await new Promise((resolve) => setTimeout(resolve, remainingTime));
                    }

                    cloudConnectionPromise.finally(() => {
                        AppController._loadBackgroundData(user);
                    });
                } finally {
                    // Detener rotación de tips y ocultar pantalla de carga
                    ProductivityTips.stopRotation();
                    appLoadingEl.classList.add('hidden');
                }
            }

            // Preparar UI (síncrono, rápido)
            static _prepareUI(user) {
                const isPosOnlyUser = AppController.isPosOnlyUser();
                document.getElementById('userName').textContent = user.displayName || user.email;
                document.getElementById('userRole').textContent = isPosOnlyUser ? `${t('roles.seller')} / POS` : t('roles.admin');
                document.getElementById('userInitials').textContent = (user.displayName || user.email).substring(0, 2).toUpperCase();
                document.getElementById('dropdownUserName').textContent = user.displayName || user.email;
                document.getElementById('dropdownUserEmail').textContent = user.email;

                // Indicador visual de modo offline
                if (AppState.offlineMode) {
                    const syncDot = document.getElementById('syncDot');
                    const syncText = document.getElementById('syncText');
                    if (syncDot) {
                        syncDot.className = 'w-2 h-2 rounded-full bg-amber-500';
                    }
                    if (syncText) {
                        syncText.textContent = 'Offline';
                        syncText.classList.add('text-amber-600');
                    }
                    const userRoleEl = document.getElementById('userRole');
                    if (userRoleEl && !userRoleEl.textContent.includes('Offline')) {
                        userRoleEl.textContent += ' · Offline';
                    }
                }
                document.getElementById('dropdownProfileLink')?.classList.toggle('hidden', isPosOnlyUser);
                document.getElementById('dropdownSettingsLink')?.classList.toggle('hidden', isPosOnlyUser);
                AppController.renderNavigation();
                ui.applyTheme(store.data.settings?.theme || AppState.settings.theme || 'light');
                ui.updateLicenseUI();
                ui.updateLocalSelector();
                ui.currentTicket = ui.getNextTicket(store.getActivePosTerminal()?.code);
            }

            // Cargar datos en background (no bloquea UI)
            static async _loadBackgroundData(user) {
                // Estas operaciones no son críticas para mostrar la UI.
                // Evitar publicar todo el estado local automáticamente al iniciar,
                // ya que puede re-crear entregas antiguas desde datos heredados.
                const backgroundTasks = [
                    ui.loadExternalOrders(false).catch(err => console.warn('No se pudieron cargar órdenes externas:', err))
                ];
                
                // Precargar módulo contable si auto-import está activado
                const accountingConfigs = store.get('accountingConfigs') || {};
                if (accountingConfigs.invoiceAutoEntries && typeof ui.accountingImportSale !== 'function') {
                    backgroundTasks.push(
                        import('/scripts/rw-accounting.js')
                            .then(() => console.log('[Background] Módulo contable precargado para auto-import'))
                            .catch(err => console.warn('[Background] No se pudo precargar contabilidad:', err))
                    );
                }
                
                // Ejecutar en paralelo sin await (fire and forget)
                Promise.all(backgroundTasks).then(() => {
                    console.log('[Background] Datos cargados exitosamente');
                }).catch(err => {
                    console.warn('[Background] Algunas operaciones fallaron:', err);
                });
            }

            static getSidebarSections() {
                const canSeeAdmin = AppState.userRole === 'admin' || AppState.userRole === 'manager';
                const plan = getCurrentPlan();
                const level = planLevel(plan);
                const pageReqs = {
                    quotes: 2, deliveries: 2, 'web-orders': 2,
                    inventory: 2, suppliers: 2, purchases: 2, transfers: 2,
                    'container-receipts': 2,
                    promotions: 2, returns: 2, credits: 2, 'cash-register': 2,
                    taxes: 3, 'expiry-promotions': 3, 'demand-forecast': 3,
                    users: 3, accounting: 3
                };
                
                const allItems = [
                    { id: 'pos', label: t('nav.pos'), icon: 'fa-cash-register', block: 'A' },
                    { id: 'dashboard', label: t('nav.dashboard'), icon: 'fa-chart-line', block: 'A' },
                    { id: 'clients', label: t('nav.clients'), icon: 'fa-users', block: 'A' },
                    { id: 'reports', label: t('nav.reports') || 'Informes', icon: 'fa-chart-bar', block: 'A' },
                    { id: 'crm', label: 'CRM Fidelización', icon: 'fa-gem', block: 'A', req: 2 },
                    
                    { id: 'products', label: t('nav.products'), icon: 'fa-box', block: 'B', parent: 'catalog' },
                    { id: 'categories', label: t('nav.categories'), icon: 'fa-tags', block: 'B', parent: 'catalog' },
                    { id: 'inventory', label: t('nav.inventory'), icon: 'fa-warehouse', block: 'B', parent: 'catalog', req: 2 },
                    { id: 'warehouses', label: t('nav.warehouses') || 'Almacenes', icon: 'fa-warehouse', block: 'B', parent: 'catalog' },
                    { id: 'transfers', label: t('nav.transfers') || 'Transferencias', icon: 'fa-exchange-alt', block: 'B', parent: 'catalog', req: 2 },
                    
                    { id: 'invoices', label: t('nav.invoices'), icon: 'fa-file-invoice-dollar', block: 'B', parent: 'sales' },
                    { id: 'quotes', label: 'Presupuestos', icon: 'fa-file-invoice', block: 'B', parent: 'sales', req: 2 },
                    { id: 'deliveries', label: t('nav.deliveries'), icon: 'fa-shipping-fast', block: 'B', parent: 'sales', req: 2 },
                    { id: 'web-orders', label: t('nav.webOrders'), icon: 'fa-globe', block: 'B', parent: 'sales', req: 2 },
                    
                    { id: 'suppliers', label: t('nav.suppliers'), icon: 'fa-truck', block: 'B', parent: 'suppliers', req: 2 },
                    { id: 'purchases', label: 'Compras', icon: 'fa-shopping-basket', block: 'B', parent: 'suppliers', req: 2 },
                    { id: 'container-receipts', label: 'Recepción Contenedores', icon: 'fa-ship', block: 'B', parent: 'suppliers', req: 2 },
                    
                    { id: 'cash-register', label: t('nav.cashRegister'), icon: 'fa-cash-register', block: 'C', req: 2 },
                    { id: 'accounting', label: t('nav.accounting'), icon: 'fa-calculator', block: 'C', req: 3 },
                    { id: 'users', label: t('nav.users'), icon: 'fa-user-shield', block: 'C', req: 3 },
                    { id: 'settings', label: t('nav.settings'), icon: 'fa-cog', block: 'C' },
                    { id: 'audit', label: t('nav.audit') || 'Auditoría', icon: 'fa-clipboard-list', block: 'C' },
                    { id: 'backup', label: t('nav.backup'), icon: 'fa-cloud-download-alt', block: 'C' }
                ];
                
                return allItems.filter(item => {
                    if (item.block === 'C' && !canSeeAdmin) return false;
                    return level >= (item.req || 1);
                });
            }

            static getSidebarSectionForPage(pageId) {
                const map = {
                    pos: 'A', dashboard: 'A', clients: 'A', reports: 'A', crm: 'A',
                    products: 'B', categories: 'B', inventory: 'B', warehouses: 'B', transfers: 'B',
                    invoices: 'B', quotes: 'B', deliveries: 'B', 'web-orders': 'B',
                    suppliers: 'B', purchases: 'B', 'container-receipts': 'B',
                    'cash-register': 'C', accounting: 'C', users: 'C', settings: 'C', audit: 'C', backup: 'C'
                };
                return map[pageId] || 'A';
            }

            static setSidebarSection(sectionId) {
                AppState.sidebarSection = sectionId;
                AppController.renderNavigation();
            }


            static getSidebarFavorites() {
                try {
                    return JSON.parse(localStorage.getItem('rw_sidebar_favorites') || '[]');
                } catch { return []; }
            }

            static toggleSidebarFavorite(pageId, event) {
                if (event) event.stopPropagation();
                const favs = AppController.getSidebarFavorites();
                const idx = favs.indexOf(pageId);
                if (idx > -1) {
                    favs.splice(idx, 1);
                } else {
                    favs.push(pageId);
                }
                localStorage.setItem('rw_sidebar_favorites', JSON.stringify(favs));
                AppController.renderNavigation();
            }

            static renderNavigation() {
                const container = document.getElementById('sidebarNavSections');
                if (!container) return;
                
                const currentPage = AppState.currentPage || 'dashboard';
                const userRole = AppState.userRole || 'admin';
                const canSeeAdmin = userRole === 'admin' || userRole === 'manager';
                const plan = getCurrentPlan();
                const level = planLevel(plan);
                
                const items = AppController.getSidebarSections();
                const blockA = items.filter(i => i.block === 'A');
                const blockB = items.filter(i => i.block === 'B');
                const blockC = items.filter(i => i.block === 'C');
                
                const openSection = AppState.sidebarSection || AppController.getSidebarSectionForPage(currentPage);
                
                const favs = AppController.getSidebarFavorites();
                const renderItem = (item, showPin = true) => {
                    const isActive = item.id === currentPage;
                    const isLocked = level < (item.req || 1) && (item.req || 1) > 1;
                    const isFav = favs.includes(item.id);
                    return `
                        <button data-page="${item.id}" onclick="${isLocked ? '' : `ui.navigateTo('${item.id}')`}" 
                            class="sidebar-nav-item ${isActive ? 'is-active' : ''} ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}" title="${item.label}">
                            <span class="nav-icon"><i class="fas ${item.icon}"></i></span>
                            <span class="nav-label">${item.label}</span>
                            ${isLocked ? '<span class="sidebar-pro-badge">PRO</span>' : ''}
                            ${!isLocked && showPin ? `<span onclick="AppController.toggleSidebarFavorite('${item.id}', event)" class="ml-auto px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer" title="${isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}"><i class="fas fa-thumbtack ${isFav ? 'text-sky-500' : 'text-slate-300'} text-[10px]"></i></span>` : ''}
                        </button>
                    `;
                };
                
                const renderParent = (id, label, icon, children) => {
                    const hasActiveChild = children.some(c => c.id === currentPage);
                    const isOpen = openSection === id || hasActiveChild;
                    return `
                        <div class="sidebar-block">
                            <button type="button" class="sidebar-nav-item ${isOpen ? 'is-open' : ''}" onclick="AppController.toggleSidebarParent('${id}')">
                                <span class="nav-icon"><i class="fas ${icon}"></i></span>
                                <span class="nav-label">${label}</span>
                                <i class="fas fa-chevron-down nav-chevron ${isOpen ? 'rotate-180' : ''}"></i>
                            </button>
                            <div class="sidebar-children ${isOpen ? 'is-expanded' : ''}" data-parent="${id}">
                                ${children.map(c => `
                                    <button data-page="${c.id}" onclick="ui.navigateTo('${c.id}')" 
                                        class="sidebar-child-item ${c.id === currentPage ? 'is-active' : ''}">
                                        ${c.label}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    `;
                };
                
                const catalogChildren = blockB.filter(i => i.parent === 'catalog');
                const salesChildren = blockB.filter(i => i.parent === 'sales');
                const supplierChildren = blockB.filter(i => i.parent === 'suppliers');
                
                let html = '';
                
                // Block A — Acceso Rápido + Favorites
                const staticBlockA = blockA.map(item => item.id);
                const favItems = items.filter(i => favs.includes(i.id) && !staticBlockA.includes(i.id));
                const allBlockA = [...blockA, ...favItems];
                html += `
                    <div class="sidebar-block sidebar-block-a">
                        <div class="sidebar-block-header">Acceso Rápido</div>
                        ${allBlockA.map(item => {
                            const isActive = item.id === currentPage;
                            const highlightSeller = (userRole === 'seller' || userRole === 'cashier') && item.id === 'pos';
                            const isFav = favs.includes(item.id);
                            return `
                                <button data-page="${item.id}" onclick="ui.navigateTo('${item.id}')" 
                                    class="sidebar-nav-item ${isActive ? 'is-active' : ''} ${highlightSeller ? 'ring-1 ring-sky-300' : ''}">
                                    <span class="nav-icon"><i class="fas ${item.icon}"></i></span>
                                    <span class="nav-label">${item.label}</span>
                                    ${isFav && !staticBlockA.includes(item.id) ? '<span class="ml-auto"><i class="fas fa-thumbtack text-sky-500 text-[10px]"></i></span>' : ''}
                                </button>
                            `;
                        }).join('')}
                    </div>
                `;
                
                // Block B — Operaciones
                if (catalogChildren.length || salesChildren.length || supplierChildren.length) {
                    html += `<div class="sidebar-block">`;
                    html += `<div class="sidebar-block-header">Operaciones</div>`;
                    if (catalogChildren.length) html += renderParent('catalog', 'Catálogo e Inventario', 'fa-boxes-stacked', catalogChildren);
                    if (salesChildren.length) html += renderParent('sales', 'Ventas y Clientes', 'fa-cash-register', salesChildren);
                    if (supplierChildren.length) html += renderParent('suppliers', 'Proveedores', 'fa-truck', supplierChildren);
                    html += `</div>`;
                }
                
                // Block C — Administración
                if (blockC.length && canSeeAdmin) {
                    html += `<div class="sidebar-block">`;
                    html += `<div class="sidebar-block-header">Administración</div>`;
                    html += blockC.map(renderItem).join('');
                    html += `</div>`;
                }
                
                container.innerHTML = html;
                
                // Update sidebar footer
                const sidebarName = document.getElementById('sidebarUserName');
                const sidebarRole = document.getElementById('sidebarUserRole');
                const sidebarInitials = document.getElementById('sidebarUserInitials');
                if (sidebarName) sidebarName.textContent = AppState.user?.displayName || AppState.user?.email || '--';
                if (sidebarRole) sidebarRole.textContent = AppState.userRole || '--';
                if (sidebarInitials) sidebarInitials.textContent = (AppState.user?.displayName || AppState.user?.email || '?').charAt(0).toUpperCase();
            }

            static toggleSidebarParent(parentId) {
                const el = document.querySelector(`.sidebar-children[data-parent="${parentId}"]`);
                const btn = el?.previousElementSibling;
                if (el) {
                    const isExpanded = el.classList.contains('is-expanded');
                    if (isExpanded) {
                        el.classList.remove('is-expanded');
                        btn?.classList.remove('is-open');
                    } else {
                        el.classList.add('is-expanded');
                        btn?.classList.add('is-open');
                    }
                }
            }

            static showLoginScreen() {
                document.getElementById('splashScreen').classList.add('hidden');
                document.getElementById('loginScreen').classList.remove('hidden');
                
                document.getElementById('loginForm').onsubmit = async (e) => {
                    e.preventDefault();
                    const email = String(document.getElementById('loginEmail')?.value || '').trim();
                    const password = String(document.getElementById('loginPassword')?.value || '').trim();
                    const pin = String(document.getElementById('recoveryPin')?.value || '').trim();
                    const btn = document.getElementById('loginBtn');

                    if (!email || !password) {
                        ui.showToast(t('toast.enterEmailPassword'), 'warning');
                        return;
                    }

                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>' + t('login.signingIn');

                    // 1. Intentar Firebase online
                    try {
                        AppController.setLoginTarget('dashboard');
                        const rememberSession = !!document.getElementById('rememberMe')?.checked;
                        await setPersistence(auth, rememberSession ? browserLocalPersistence : browserSessionPersistence);
                        const userCredential = await signInWithEmailAndPassword(auth, email, password);

                        // Login online exitoso: guardar para offline
                        if (userCredential?.user) {
                            await OfflineAuth.saveCredentials(email, password, userCredential.user);
                            OfflineAuth.saveSession(userCredential.user);
                            if (pin && pin.length === 6) {
                                await OfflineAuth.saveRecoveryPin(pin);
                            }
                        }
                        return; // onAuthStateChanged maneja el resto
                    } catch (error) {
                        const normalizedCode = error?.code || 'auth/unknown';
                        const isNetworkError = normalizedCode === 'auth/network-request-failed' ||
                                              normalizedCode === 'auth/timeout' ||
                                              normalizedCode === 'auth/internal-error' ||
                                              !navigator.onLine;

                        if (!isNetworkError) {
                            // Error real de Firebase (credenciales incorrectas, etc.)
                            if (normalizedCode === 'auth/user-not-found' || normalizedCode === 'auth/invalid-credential' || normalizedCode === 'auth/wrong-password') {
                                ui.showToast(t('toast.invalidCredentials'), 'error');
                            } else if (normalizedCode === 'auth/invalid-email') {
                                ui.showToast(t('toast.invalidEmailFormat'), 'error');
                            } else if (normalizedCode === 'auth/too-many-requests') {
                                ui.showToast(t('toast.tooManyAttempts'), 'warning');
                            } else {
                                ui.showToast(t('toast.accessError', error?.message || normalizedCode), 'error');
                            }
                            btn.disabled = false;
                            btn.innerHTML = '<span data-i18n="login.signIn">' + t('login.signIn') + '</span><i class="fas fa-arrow-right"></i>';
                            return;
                        }

                        // 2. Fallback offline por error de red
                        console.warn('[Login] Error de red detectado, intentando login offline...');

                        // 2a. Intentar verificación por PIN primero si se proporcionó
                        if (pin && pin.length === 6) {
                            const pinValid = await OfflineAuth.verifyRecoveryCode(pin);
                            if (pinValid) {
                                const session = OfflineAuth.getSession();
                                if (session) {
                                    const offlineUser = {
                                        uid: session.uid,
                                        email: session.email,
                                        displayName: session.displayName,
                                        emailVerified: true
                                    };
                                    AppState.offlineMode = true;
                                    ui.showToast('Acceso offline mediante PIN. Modo sin conexión activado.', 'warning', 4000);
                                    await AppController.initializeApp(offlineUser);
                                    return;
                                }
                            }
                        }

                        // 2b. Verificar credenciales offline
                        const offlineUserData = await OfflineAuth.verifyCredentials(email, password);
                        if (offlineUserData) {
                            const offlineUser = {
                                uid: offlineUserData.uid,
                                email: offlineUserData.email,
                                displayName: offlineUserData.displayName,
                                emailVerified: true
                            };
                            OfflineAuth.saveSession(offlineUser);
                            AppState.offlineMode = true;
                            ui.showToast('Sin conexión a internet. Entrando en modo offline.', 'warning', 4000);
                            await AppController.initializeApp(offlineUser);
                            return;
                        }

                        ui.showToast('Credenciales incorrectas o sin datos guardados para modo offline', 'error');
                        btn.disabled = false;
                        btn.innerHTML = '<span data-i18n="login.signIn">' + t('login.signIn') + '</span><i class="fas fa-arrow-right"></i>';
                    }
                };
                
                document.getElementById('togglePassword').onclick = () => {
                    const input = document.getElementById('loginPassword');
                    const icon = document.querySelector('#togglePassword i');
                    input.type = input.type === 'password' ? 'text' : 'password';
                    icon.className = input.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
                };
            }

            static openPOSAccessModal() {
                const rawEmail = String(document.getElementById('loginEmail')?.value || '').trim();
                const safeEmail = rawEmail.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const rememberChecked = !!document.getElementById('rememberMe')?.checked;

                ui.openModal({
                    title: t('login.quickAccessTitle'),
                    size: 'md',
                    content: `
                        <div class="space-y-4">
                            <div class="rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/80 dark:bg-sky-900/10 p-3">
                                <p class="font-semibold text-sky-700 dark:text-sky-300"><i class="fas fa-cash-register mr-2"></i>${t('login.posOnlyInfo')}</p>
                                <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">${t('login.quickAccessDesc')}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">${t('login.email')}</label>
                                <input type="email" id="posAccessEmail" value="${safeEmail}" class="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none" placeholder="cajero@empresa.com">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">${t('login.password')}</label>
                                <div class="relative">
                                    <input type="password" id="posAccessPassword" readonly autocomplete="current-password" class="w-full pl-4 pr-24 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none cursor-pointer" placeholder="••••••••" onclick="ui.showNumpad({targetId:'posAccessPassword', mode:'login', title:'Introduzca contraseña', onConfirm:function(){AppController.submitPOSAccessLogin();}})">
                                    <button type="button" onclick="ui.showNumpad({targetId:'posAccessPassword', mode:'login', title:'Introduzca contraseña', onConfirm:function(){AppController.submitPOSAccessLogin();}})" class="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-600 px-2">
                                        <i class="fas fa-th"></i>
                                    </button>
                                    <button type="button" id="togglePosAccessPassword" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-gray-600">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                            </div>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="posAccessRemember" class="rounded text-primary-600" ${rememberChecked ? 'checked' : ''}>
                                <span class="text-sm text-gray-600 dark:text-slate-400">${t('login.rememberSession')}</span>
                            </label>
                        </div>
                    `,
                    footer: `
                        <button onclick="ui.closeModal()" class="btn-secondary-enterprise text-sm mr-2">${t('common.cancel')}</button>
                        <button id="posAccessBtn" onclick="AppController.submitPOSAccessLogin()" class="px-4 py-2 rounded-xl btn-primary-enterprise text-white">
                            <i class="fas fa-store mr-2"></i>${t('login.enterPOS')}
                        </button>
                    `
                });

                setTimeout(() => {
                    const passwordInput = document.getElementById('posAccessPassword');
                    const toggleBtn = document.getElementById('togglePosAccessPassword');
                    const emailInput = document.getElementById('posAccessEmail');
                    if (passwordInput) {
                        passwordInput.focus();
                        passwordInput.addEventListener('keydown', (event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                AppController.submitPOSAccessLogin();
                            }
                        });
                    }
                    if (emailInput && !rawEmail) emailInput.focus();
                    if (toggleBtn) {
                        toggleBtn.onclick = () => {
                            const icon = toggleBtn.querySelector('i');
                            if (!passwordInput || !icon) return;
                            passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
                            icon.className = passwordInput.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
                        };
                    }
                }, 80);
            }

            static async submitPOSAccessLogin() {
                const email = String(document.getElementById('posAccessEmail')?.value || '').trim();
                const password = String(document.getElementById('posAccessPassword')?.value || '').trim();
                const btn = document.getElementById('posAccessBtn');

                if (!email || !password) {
                    ui.showToast('Ingrese email y contrasena para entrar al POS', 'warning');
                    return;
                }

                const loginEmail = document.getElementById('loginEmail');
                const loginPassword = document.getElementById('loginPassword');
                const rememberMain = document.getElementById('rememberMe');
                const rememberSession = !!document.getElementById('posAccessRemember')?.checked;
                if (loginEmail) loginEmail.value = email;
                if (loginPassword) loginPassword.value = password;
                if (rememberMain) rememberMain.checked = rememberSession;

                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Entrando...';
                }

                try {
                    AppController.setLoginTarget('pos');
                    await setPersistence(auth, rememberSession ? browserLocalPersistence : browserSessionPersistence);
                    await signInWithEmailAndPassword(auth, email, password);
                    ui.closeModal();
                } catch (error) {
                    const normalizedCode = error?.code || 'auth/unknown';
                    if (normalizedCode === 'auth/user-not-found' || normalizedCode === 'auth/invalid-credential' || normalizedCode === 'auth/wrong-password') {
                        ui.showToast('Credenciales invalidas. Verifique email y contrasena.', 'error');
                    } else if (normalizedCode === 'auth/invalid-email') {
                        ui.showToast('Formato de email invalido.', 'error');
                    } else if (normalizedCode === 'auth/too-many-requests') {
                        ui.showToast('Demasiados intentos. Espere unos minutos.', 'warning');
                    } else {
                        ui.showToast('Error de acceso al POS: ' + (error?.message || normalizedCode), 'error');
                    }
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-store mr-2"></i>Entrar al POS';
                    }
                }
            }

            static setupEventListeners() {
                document.getElementById('sidebarToggle')?.addEventListener('click', () => {
                    document.getElementById('sidebar').classList.toggle('-translate-x-full');
                    document.getElementById('sidebarOverlay').classList.toggle('hidden');
                });
                
                document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
                    document.getElementById('sidebar').classList.add('-translate-x-full');
                    document.getElementById('sidebarOverlay').classList.add('hidden');
                });
                
                document.getElementById('userMenuBtn')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.getElementById('userDropdown').classList.toggle('hidden');
                });
                
                document.addEventListener('click', (e) => {
                    document.getElementById('userDropdown')?.classList.add('hidden');
                    
                    // Cerrar dropdown de búsqueda global al hacer clic fuera
                    const searchContainer = document.getElementById('globalSearchContainer');
                    const searchResults = document.getElementById('globalSearchResults');
                    if (searchContainer && searchResults && !searchContainer.contains(e.target)) {
                        searchResults.classList.add('hidden');
                    }
                });
                
                document.getElementById('themeToggleBtn')?.addEventListener('click', () => ui.toggleTheme());
                ui.applyTheme(store.data.settings?.theme || AppState.settings.theme || 'light');                
                window.addEventListener('online', () => {
                    AppState.isOnline = true;
                    store.updateSyncIndicator();
                    store.processOfflineOperations();

                    // Auto-sync: si estábamos en modo offline, intentar reconectar con Firebase
                    if (AppState.offlineMode && OfflineAuth.hasCredentials()) {
                        const creds = OfflineAuth.getCredentials();
                        if (creds?.email) {
                            console.log('[AutoSync] Intentando reconectar sesión offline con Firebase...');
                            // No tenemos la contraseña guardada en texto plano, solo el hash.
                            // El usuario debe hacer login manualmente para sincronizar.
                            ui.showToast('Conexión restablecida. Por seguridad, vuelve a iniciar sesión para sincronizar.', 'info', 6000);
                        }
                    }
                });
                
                window.addEventListener('offline', () => {
                    AppState.isOnline = false;
                    store.updateSyncIndicator();
                });

                // Listen for CRM iframe messages to reload clients
                window.addEventListener('message', (e) => {
                    if (e.data && e.data.type === 'CRM_CLIENT_UPDATED') {
                        console.log('[App] CRM updated a client, reloading clients from localStorage');
                        store.loadFromLocalStorage();
                        if (typeof ui !== 'undefined' && ui.renderClients) ui.renderClients();
                    }
                    // Wallet payment responses from CRM iframe
                    if (e.data && e.data.type === 'WALLET_PAYMENT_CONFIRMED' && AppState.pendingWalletSale) {
                        console.log('[POS] postMessage WALLET_PAYMENT_CONFIRMED:', e.data);
                        if (typeof ui !== 'undefined' && ui.completeWalletSale) {
                            ui.completeWalletSale(AppState.pendingWalletSale, e.data.pin);
                        }
                    }
                    if (e.data && e.data.type === 'WALLET_PAYMENT_REJECTED' && AppState.pendingWalletSale) {
                        console.log('[POS] postMessage WALLET_PAYMENT_REJECTED:', e.data);
                        if (typeof ui !== 'undefined' && ui.cancelWalletPayment) {
                            ui.cancelWalletPayment(AppState.pendingWalletSale.saleId);
                        }
                    }
                });

                // Wallet payment responses via BroadcastChannel (cross-tab/frame)
                try {
                    const walletBC = new BroadcastChannel('rw-wallet-payment');
                    walletBC.onmessage = (event) => {
                        const msg = event.data;
                        console.log('[POS] BroadcastChannel message:', msg);
                        if (!msg || !AppState.pendingWalletSale) return;
                        if (msg.type === 'WALLET_PAYMENT_CONFIRMED' && msg.saleId === AppState.pendingWalletSale.saleId) {
                            if (typeof ui !== 'undefined' && ui.completeWalletSale) {
                                ui.completeWalletSale(AppState.pendingWalletSale, msg.pin);
                            }
                        }
                        if (msg.type === 'WALLET_PAYMENT_REJECTED' && msg.saleId === AppState.pendingWalletSale.saleId) {
                            if (typeof ui !== 'undefined' && ui.cancelWalletPayment) {
                                ui.cancelWalletPayment(AppState.pendingWalletSale.saleId);
                            }
                        }
                    };
                } catch (e) { /* BroadcastChannel not supported */ }
                // Fallback: localStorage cross-tab sync
                window.addEventListener('storage', (e) => {
                    if (e.key === 'rw_wallet_response') {
                        try {
                            const msg = JSON.parse(e.newValue);
                            console.log('[POS] localStorage wallet response:', msg);
                            if (!msg || !AppState.pendingWalletSale) return;
                            if (msg.type === 'WALLET_PAYMENT_CONFIRMED' && msg.saleId === AppState.pendingWalletSale.saleId) {
                                if (typeof ui !== 'undefined' && ui.completeWalletSale) {
                                    ui.completeWalletSale(AppState.pendingWalletSale, msg.pin);
                                }
                            }
                            if (msg.type === 'WALLET_PAYMENT_REJECTED' && msg.saleId === AppState.pendingWalletSale.saleId) {
                                if (typeof ui !== 'undefined' && ui.cancelWalletPayment) {
                                    ui.cancelWalletPayment(AppState.pendingWalletSale.saleId);
                                }
                            }
                        } catch (err) {}
                    }
                });
            }

            static async logout() {
                if (store.getCurrentCashRegister()?.isOpen) {
                    ui.promptCloseCashBeforeLogout();
                    return;
                }
                await AppController.completeLogout();
            }

            static async completeLogout() {
                store.disconnectCloud();
                AppController.setLoginTarget('dashboard');
                try { await signOut(auth); } catch (e) { /* puede fallar si está offline */ }
                OfflineAuth.clearSession();
                AppState.offlineMode = false;
                AppState.demoMode = false;
                AppState.user = null;
                location.reload();
            }

            static async showPasswordReset() {
                const email = document.getElementById('loginEmail').value;
                if (!email) { ui.showToast(t('toast.enterEmail'), 'warning'); return; }
                try {
                    await sendPasswordResetEmail(auth, email);
                    ui.showToast(t('toast.emailSent'), 'success');
                } catch (error) {
                    ui.showToast(t('common.errorMsg', error.message), 'error');
                }
            }

            static async loginWithGoogle() {
                const provider = new GoogleAuthProvider();
                try {
                    await signInWithPopup(auth, provider);
                } catch (error) {
                    ui.showToast(t('common.errorMsg', error.message), 'error');
                }
            }

            static async loginWithMicrosoft() {
                ui.showToast(t('toast.microsoftLoginSoon'), 'info');
            }
        }

        window.AppController = AppController;
