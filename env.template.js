/**
 * RIVER-WALL ERP V.5.0 - Environment Configuration Template
 * Copia este archivo como env.js y completa tus credenciales.
 * NO subas env.js al repositorio.
 */

(function() {
    'use strict';
    window.ENV = window.ENV || {};

    window.ENV = {
        FIREBASE: {
            apiKey: "TU_API_KEY",
            authDomain: "tu-proyecto.firebaseapp.com",
            projectId: "tu-proyecto",
            storageBucket: "tu-proyecto.firebasestorage.app",
            messagingSenderId: "000000000000",
            appId: "1:000000000000:web:xxxxxxxxxxxxxx"
        },
        SUPABASE: {
            URL: 'https://tu-proyecto.supabase.co',
            ANON_KEY: 'tu-anon-key-aqui'
        },
        APP: {
            name: "RIVER-WALL ERP V.5.0",
            version: "5.0.0",
            environment: "development"
        },
        FEATURES: {
            analytics: false,
            crashlytics: false,
            perfMonitoring: false
        }
    };
})();
