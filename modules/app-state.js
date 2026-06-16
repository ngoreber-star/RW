        // ==================== APP STATE ====================
        var AppState = {
            user: null,
            tenant: null,
            userRole: 'cashier',
            isOnline: navigator.onLine,
            offlineMode: false,
            currentPage: 'dashboard',
            loginTarget: sessionStorage.getItem('rw_login_target') === 'pos' ? 'pos' : 'dashboard',
            posCart: [],
            externalOrders: [],
            externalOrderDraft: null,
            externalOrdersLastSync: null,
            notifications: [],
            settings: { theme: localStorage.getItem('rw_theme') || 'light', currency: 'XAF', taxRate: 0 },
            currentLocalId: null,
            demoMode: false,
            inventoryTab: 'stock',
            trainingTab: 'exam',
            trainingExam: null,
            practicalExam: null
        };
        window.AppState = AppState;
