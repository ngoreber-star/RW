# RIVER-WALL PRO v3.3 - Supabase Migration

## Resumen

Migración de RIVER-WALL PRO desde Firebase Firestore a **Supabase** (PostgreSQL + Realtime).

**Por qué:** Firestore Spark tiene límite de 20,000 writes/día. `saveToSubcollections()` re-escribía ~1,200 documentos por cada venta. Con Supabase, cada venta es **1-3 operaciones SQL**.

## Costo comparativo

| Plan | Límite | Costo mensual |
|------|--------|---------------|
| Firebase Spark | 20,000 writes/día | $0 (bloqueado rápido) |
| Firebase Blaze | Ilimitado (cobro por uso) | ~$20-100/mes por negocio |
| **Supabase Free** | **500MB + 500K writes/mes** | **$0** |
| **Supabase Pro** | **8GB + ilimitado** | **$25/mes** (para 200+ negocios) |

## Estructura creada

```
RIVER-WALL SUPABASE/
├── migrations/
│   ├── 001_core_schema.sql      -- Tablas base (products, clients, sales, warehouses, etc.)
│   ├── 002_crm_schema.sql       -- Tablas CRM (wallet, coupons, campaigns, loyalty)
│   ├── 003_rls_policies.sql     -- Row Level Security por tenant
│   └── 004_functions_triggers.sql -- (próximo) Funciones y triggers avanzados
├── supabase-client.js           -- Cliente offline-first + cola de sync
├── offline-mode.js              -- Fallback cuando no hay internet ni Supabase
├── sw.js                        -- Service Worker PWA (cachea assets + Supabase SDK)
├── manifest.webmanifest         -- Configuración PWA
└── README.md                    -- Este archivo
```

## Requisitos previos

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a Project Settings → API → copiar `URL` y `anon public`
3. Ir a SQL Editor → New query → pegar las migrations 001, 002, 003
4. Ir a Authentication → Settings → desactivar "Confirm email" (para POS rápido)
5. Opcional: ir to Authentication → Providers → activar "Phone" si quieres SMS

## Configuración en `software.html`

### 1. Incluir scripts (en el `<head>` o antes de cerrar `</body>`)

```html
<!-- Supabase SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

<!-- Offline fallback (antes de supabase-client.js) -->
<script src="scripts/offline-mode.js"></script>

<!-- RIVER-WALL Supabase Client -->
<script src="scripts/supabase-client.js"></script>
```

### 2. Inicializar en lugar de Firebase

```javascript
// REEMPLAZAR esto:
// const app = initializeApp(firebaseConfig);
// const db = getFirestore(app);

// POR esto:
async function initApp() {
    const { supabase, dataStore, auth } = await SupabaseClient.init();

    // Configurar credenciales (primera vez, luego se guardan en localStorage)
    if (!localStorage.getItem('sb_url')) {
        SupabaseClient.configure('https://tu-proyecto.supabase.co', 'tu-anon-key');
    }

    // Login
    const { user, tenant, error } = await auth.signIn(email, password);
    if (error) {
        console.error('Login failed:', error.message);
        return;
    }

    // Set tenant para dataStore
    dataStore.setTenant(tenant.id, user.id);

    // Sync inicial
    await dataStore.syncAllTables(tenant.id);

    // Activar realtime
    dataStore.subscribeRealtime('products', tenant.id, (payload) => {
        console.log('Producto cambiado:', payload);
    });
    dataStore.subscribeRealtime('sales', tenant.id, (payload) => {
        console.log('Venta nueva:', payload);
    });

    // Ahora tu app usa dataStore.getAll('products') en vez de store.get('products')
}
```

### 3. Cambiar operaciones CRUD

#### Antes (Firebase/DataStore)
```javascript
store.save('products'); // Re-escribía 200 productos a Firestore
```

#### Después (Supabase)
```javascript
// Insertar producto nuevo
dataStore.insert('products', newProduct); // Guarda local + encola sync

// O directo a Supabase (si hay internet)
await supabase.from('products').insert({ ...newProduct, tenant_id: tenantId });

// Actualizar stock
dataStore.update('products', productId, { stock: newStock });
```

### 4. Guardar una venta (POS checkout)

#### Antes
```javascript
saveSaleRecord(sale);
store.scheduleCloudSave(); // Re-escribía TODO a Firestore (~1,200 docs)
```

#### Después
```javascript
async function saveSaleRecord(sale) {
    // 1. Insertar venta
    const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({ ...sale, tenant_id: tenantId })
        .select()
        .single();

    if (saleError) throw saleError;

    // 2. Actualizar stock de cada item (batch opcional)
    for (const item of sale.items) {
        await supabase.rpc('decrement_stock', {
            p_product_id: item.productId,
            p_quantity: item.quantity,
            p_tenant_id: tenantId,
        });
    }

    // 3. Si es wallet, crear wallet_transaction
    if (sale.paymentMethod === 'wallet' && sale.clientId) {
        await supabase.from('wallet_transactions').insert({
            tenant_id: tenantId,
            client_id: sale.clientId,
            type: 'debit',
            amount: sale.total,
            description: `Compra ${saleData.sale_number}`,
            reference_id: saleData.id,
            reference_type: 'sale',
        });
    }

    // 4. CRM: loyalty points
    const points = Math.floor(sale.total / 1000);
    if (points > 0) {
        await supabase.rpc('add_loyalty_points', {
            p_client_id: sale.clientId,
            p_points: points,
            p_tenant_id: tenantId,
        });
    }
}
```

## Flujo offline-first

```
Cajero hace venta
    ↓
Se guarda en localStorage (caché local)
    ↓
Se añade a cola de sync (localStorage)
    ↓
Si hay internet → se envía a Supabase en 2 segundos
    ↓
Si NO hay internet → queda en cola
    ↓
Cuando vuelve internet → se procesa cola automáticamente
```

## Multi-tenancy

Cada tabla tiene `tenant_id`. RLS asegura que un usuario solo vea datos de sus negocios.

```sql
-- Ejemplo: un usuario con acceso a 3 negocios
SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid();
-- Result: [uuid-1, uuid-2, uuid-3]

-- La política RLS filtra automáticamente:
SELECT * FROM sales;
-- Solo devuelve sales donde tenant_id está en la lista de arriba
```

## Realtime (sync entre cajas)

```javascript
// En cada caja del mismo negocio:
dataStore.subscribeRealtime('sales', tenantId, (payload) => {
    if (payload.eventType === 'INSERT') {
        // Otra caja hizo una venta
        showToast(`Nueva venta en Caja 2: ${payload.new.total} XAF`);
    }
});
```

## PWA / Instalación

1. Registrar service worker en `software.html`:
```javascript
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}
```

2. Incluir manifest:
```html
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0f172a">
```

3. El usuario puede "Instalar" desde Chrome/Edge como una app nativa.

## Migración de datos (Firebase → Supabase)

Pendiente: se creará `scripts/migrate-firebase-to-supabase.js` que:
1. Lee todas las colecciones de Firestore
2. Las transforma a JSON
3. Las inserta en Supabase vía batch inserts

## Próximos pasos

1. [ ] Crear `004_functions_triggers.sql` con funciones RPC (decrement_stock, add_loyalty_points, etc.)
2. [ ] Adaptar `software.html` para usar `SupabaseDataStore` en vez de `DataStore`
3. [ ] Migrar `crm-client-app.html` a Supabase
4. [ ] Crear script de migración de datos
5. [ ] Testing offline/online

## Soporte

- Supabase Docs: https://supabase.com/docs
- Realtime: https://supabase.com/docs/guides/realtime
- Auth: https://supabase.com/docs/guides/auth
- Row Level Security: https://supabase.com/docs/guides/auth/row-level-security
