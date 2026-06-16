/**
 * ========================================
         * RIVER-WALL ERP V.5.0 - Environment Configuration
 * ========================================
 * ⚠️  SEGURIDAD: Las claves aquí expuestas son
 *     claves públicas (anon key) necesarias
 *     para el funcionamiento del cliente SPA.
 *     
 *     Para producción, se recomienda:
 *     1. Copiar este archivo como env.template.js
 *     2. Crear un endpoint /api/env que sirva
 *        solo las claves necesarias
 *     3. O usar variables de entorno inyectadas
 *        en el build
 * ========================================
 */

(function() {
    'use strict';
    
    window.ENV = window.ENV || {};

    // Intenta cargar desde endpoint externo primero
    async function loadFromServer() {
        try {
            const resp = await fetch('/api/env', { cache: 'no-store' });
            if (resp.ok) {
                const serverEnv = await resp.json();
                if (serverEnv.SUPABASE?.URL && serverEnv.SUPABASE?.ANON_KEY) {
                    Object.assign(window.ENV, serverEnv);
                    console.log('[ENV] Configuración cargada desde servidor');
                    return true;
                }
            }
        } catch (e) {
            // Silently fall back to local config
        }
        return false;
    }

    // Configuración local (fallback / desarrollo)
    const localConfig = {
        // Firebase Configuration - Solo proyecto principal
        FIREBASE: {
            apiKey: "AIzaSyDLVuuusOfGvjGy9hva_sX3ttvNfoMo-lc",
            authDomain: "river-wall.firebaseapp.com",
            projectId: "river-wall",
            storageBucket: "river-wall.firebasestorage.app",
            messagingSenderId: "427421122117",
            appId: "1:427421122117:web:b8b49c43b8ea36cf3a6d2c"
        },
        
        // App Configuration
        APP: {
            name: "RIVER-WALL ERP V.5.0",
            version: "5.0.0",
            environment: "production"
        },
        
        // Supabase Configuration (anon key es pública por diseño)
        SUPABASE: {
            URL: 'https://uabenexigmbogoepdbdx.supabase.co',
            ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhYmVuZXhpZ21ib2dvZXBkYmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzQ1MTIsImV4cCI6MjA5NTkxMDUxMn0.ac2IOsISLtfy8HvAeeC5gdSh1_PbtkBA2KCuFmWuAEU'
        },

        // Feature Flags
        FEATURES: {
            analytics: true,
            crashlytics: true,
            perfMonitoring: true
        }
    };

    // Merge local config (server override si existe)
    if (!window.ENV.SUPABASE?.URL) {
        Object.assign(window.ENV, localConfig);
    }

    // Helper function to validate config
    window.ENV.isValid = function() {
        return window.ENV.FIREBASE && window.ENV.FIREBASE.apiKey && 
               window.ENV.FIREBASE.projectId &&
               window.ENV.FIREBASE.appId;
    };

    // Carga asíncrona desde servidor (no bloqueante) — solo si hay endpoint configurado
    const hasServerEndpoint = window.ENV.APP?.envEndpoint || false;
    if (hasServerEndpoint) {
        loadFromServer().then(loaded => {
            if (loaded) {
                console.log('[ENV] Configuración remota aplicada');
            }
        });
    }
    
    console.log('[ENV] Configuración cargada para:', window.ENV.APP?.environment || 'unknown');
})();
