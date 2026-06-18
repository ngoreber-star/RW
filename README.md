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

## Estructura del proyecto

```
RIVER-WALL SUPABASE/
├── migrations/
│   ├── 001_core_schema.sql            -- Tablas base (products, clients, sales, warehouses, etc.)
│   ├── 002_crm_schema.sql             -- Tablas CRM (wallet, coupons, campaigns, loyalty)
│   ├── 003_rls_policies.sql           -- Row Level Security por tenant
│   ├── 004_functions_triggers.sql     -- Funciones RPC, tabla alerts y triggers de stock
│   ├── 005_superadmin_schema.sql      -- Schema y funciones para superadmin
│   ├── 006_bootstrap_superadmin.sql   -- Bootstrap inicial del superadmin
│   ├── 007_superadmin_panel_rpc.sql   -- RPCs del panel de superadmin
│   ├── 008_fix_user_creation.sql      -- Correcciones en creación de usuarios
│   ├── 009_fix_rls_recursion.sql      -- Fix recursión en RLS
│   ├── 010_bypass_rls_resolve_tenant.sql -- Resolución de tenant
│   ├── 011_bootstrap_superadmin_rpc.sql  -- RPCs bootstrap superadmin
│   ├── 012_fix_tenant_creation.sql    -- Correcciones creación de tenants
│   ├── 015_audit_logs.sql             -- Logs de auditoría
│   ├── 016_inventory_movements_columns.sql -- Columnas adicionales en movimientos
│   ├── 017_checkout_atomic.sql        -- Checkout atómico (process_complete_checkout)
│   ├── 018_confirm_wallet_payment.sql -- Confirmación de pagos wallet
│   ├── 019_consolidate_009_018.sql    -- Consolidación de fixes anteriores
│   ├── 020_fix_json_validation.sql    -- Validación JSON + fixes en checkout
│   ├── 020_granular_rls_policies.sql  -- Políticas RLS granulares
│   ├── 021_fix_granular_rls.sql       -- Fixes RLS granular
│   ├── 022_fix_performance_indexes.sql -- Índices de rendimiento
│   ├── 023_fix_missing_columns.sql    -- Columnas faltantes
│   ├── 024_fix_realtime_publication.sql -- Fix publicación Realtime (todas las columnas)
│   └── 025_orders_deliveries_supabase.sql -- Tablas orders, deliveries y public_deliveries
├── tests/
│   ├── 004_functions_triggers.test.sql   -- Test suite SQL para funciones y triggers
│   ├── checkout-atomicity.test.js
│   ├── conflict-resolution.test.js
│   ├── sync-queue.test.js
│   ├── tenant-resolution.test.js
│   └── setup.js
├── scripts/
│   ├── supabase-client.js         -- Cliente offline-first + cola de sync
│   ├── offline-mode.js            -- Fallback cuando no hay internet ni Supabase
│   ├── sw.js                      -- Service Worker PWA
│   └── manifest.webmanifest       -- Configuración PWA
└── README.md                      -- Este archivo
```

## Requisitos previos

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a Project Settings → API → copiar `URL` y `anon public`
3. Ir a SQL Editor → New query → pegar las migrations en orden numérico (001 a 024)
4. Ir a Authentication → Settings → desactivar "Confirm email" (para POS rápido)
5. Opcional: ir to Authentication → Providers → activar "Phone" si quieres SMS

> **Nota importante:** La migración `024_fix_realtime_publication.sql` debe aplicarse para evitar errores `42P10` cuando funciones o triggers hagan `UPDATE`/`DELETE` en tablas suscritas a Realtime. No uses listas de columnas en la publicación.

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
await supabase.rpc('decrement_stock', {
    p_tenant_id: tenantId,
    p_product_id: productId,
    p_quantity: qty,
});
```

### 4. Guardar una venta (POS checkout)

#### Opción A: Insert directo + triggers automáticos

Desde `004_functions_triggers.sql`, los triggers `on_sale_insert` y `on_sale_update` manejan el stock automáticamente:

```javascript
async function saveSaleRecord(sale) {
    const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
            ...sale,
            tenant_id: tenantId,
            status: sale.isPending ? 'pending' : 'completed'
        })
        .select()
        .single();

    if (saleError) throw saleError;

    // Stock, inventory_movements y alerts se manejan automáticamente
    // por los triggers on_sale_insert / on_sale_update.

    return saleData;
}
```

#### Opción B: Checkout atómico (recomendado)

```javascript
async function saveSaleRecord(sale) {
    const { data, error } = await supabase.rpc('process_complete_checkout', {
        p_sale_payload: {
            tenant_id: tenantId,
            items: sale.items,
            total: sale.total,
            payment_method: sale.paymentMethod,
            status: 'completed',
            client_id: sale.clientId,
            user_id: sale.userId,
        }
    });

    if (error) throw error;
    return data;
}
```

#### CRM: loyalty points

```javascript
const points = Math.floor(sale.total / 1000);
if (points > 0 && sale.clientId) {
    const { data: totalPoints } = await supabase.rpc('add_loyalty_points', {
        p_tenant_id: tenantId,
        p_client_id: sale.clientId,
        p_points: points,
    });
    console.log('Puntos totales:', totalPoints);
}
```

## Funciones RPC disponibles

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `decrement_stock` | `p_tenant_id, p_product_id, p_quantity` | `INTEGER` | Descuenta stock, genera alerta si baja del mínimo. |
| `increment_stock` | `p_tenant_id, p_product_id, p_quantity` | `INTEGER` | Devuelve stock (por anulaciones/devoluciones). |
| `add_loyalty_points` | `p_tenant_id, p_client_id, p_points` | `INTEGER` | Suma puntos y retorna el total. |
| `get_daily_sales` | `p_tenant_id, p_date` | `JSONB` | `{total_ventas, cantidad_transacciones, total_efectivo, total_tarjeta, total_wallet}` |
| `get_low_stock_products` | `p_tenant_id` | `JSONB` | Array de productos con `stock <= min_stock`. |
| `process_complete_checkout` | `p_sale_payload` | `JSONB` | Checkout atómico: venta + stock + wallet + crédito + puntos. |
| `register_credit_payment` | `p_sale_id, p_amount, p_tenant_id` | `NUMERIC` | Registra abono a venta a crédito. |
| `get_sales_summary` | `p_tenant_id, p_start_date, p_end_date` | `TABLE` | Resumen de ventas por rango de fechas. |
| `get_top_products` | `p_tenant_id, p_start_date, p_end_date, p_limit` | `TABLE` | Productos más vendidos. |
| `create_tenant_for_user` | `p_user_id, p_business_name, p_email, p_plan` | `UUID` | Crea tenant con datos por defecto. |

## Triggers de stock

| Trigger | Evento | Acción |
|---|---|---|
| `on_sale_insert` | `AFTER INSERT ON sales` | Descuenta stock de cada item si `status != 'pending'`. |
| `on_sale_update` | `AFTER UPDATE ON sales` | `pending → completed` descuenta; `completed → cancelled/refunded` devuelve. |
| `trg_update_client_tier` | `AFTER INSERT ON sales` | Actualiza tier del cliente según gasto acumulado. |

## Tabla `alerts`

Genera alertas automáticas cuando el stock de un producto queda por debajo del mínimo:

```sql
SELECT * FROM alerts WHERE tenant_id = :tenant_id AND is_read = false;
```

Tipos de alerta:
- `low_stock`
- `out_of_stock`
- `expiration`
- `system`

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

> **Importante:** La publicación `supabase_realtime` debe incluir **todas las columnas** de las tablas (no una lista parcial), de lo contrario los triggers y RPCs que actualizan estas tablas fallarán con `42P10`. Ver `024_fix_realtime_publication.sql`.

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

## Testing

Existe una test suite SQL para validar las funciones y triggers:

```
tests/004_functions_triggers.test.sql
```

Para ejecutarla:

1. Aplica todas las migraciones en orden (001 a 024).
2. Abre el SQL Editor de Supabase.
3. Copia y pega `tests/004_functions_triggers.test.sql`.
4. Ejecuta y revisa la columna `result` (esperado: todos `PASS`).

## Migración de datos (Firebase → Supabase)

Pendiente: se creará `scripts/migrate-firebase-to-supabase.js` que:
1. Lee todas las colecciones de Firestore
2. Las transforma a JSON
3. Las inserta en Supabase vía batch inserts

## Estado actual del proyecto

| # | Tarea | Estado | Notas |
|---|---|---|---|
| 1 | `001_core_schema.sql` — tablas base | ✅ Completado | products, clients, sales, warehouses, etc. |
| 2 | `002_crm_schema.sql` — tablas CRM | ✅ Completado | wallet, coupons, campaigns, loyalty, activities. |
| 3 | `003_rls_policies.sql` — seguridad por tenant | ✅ Completado | RLS + función `is_tenant_member`. |
| 4 | `004_functions_triggers.sql` — funciones y triggers | ✅ Completado | decrement_stock, increment_stock, add_loyalty_points, get_daily_sales, get_low_stock_products, tabla `alerts`, triggers `on_sale_insert`/`on_sale_update`. |
| 5 | `017`/`019`/`020` checkout atómico | ✅ Completado | `process_complete_checkout` + flag para evitar doble decremento. |
| 6 | `024_fix_realtime_publication.sql` | ✅ Archivo listo | Debe aplicarse en la base de datos de Supabase para evitar error `42P10`. |
| 7 | `tests/004_functions_triggers.test.sql` | ✅ Completado | 13/13 tests PASS en base de staging. |
| 8 | `025_orders_deliveries_supabase.sql` — migrar incoming_orders/deliveries | ✅ Completado | Tablas `orders`, `deliveries`, `public_deliveries` + RLS + trigger de sync. |
| 9 | Adaptar `software.html` al cliente de Supabase | ⚠️ Parcial | Ver sección "Adaptación de software.html" más abajo. |
| 10 | Migrar `crm-client-app.html` a Supabase | ❌ Pendiente | Panel CRM. |
| 10 | Script de migración Firebase → Supabase | ❌ Pendiente | `scripts/migrate-firebase-to-supabase.js`. |
| 11 | Testing offline/online completo | ❌ Pendiente | Validar cola de sync y fallback offline. |

## Adaptación de `software.html`

`software.html` **no está completamente reescrito para Supabase**. Actualmente opera en modo **híbrido/compatibility**:

### Qué sí funciona con Supabase

- Autenticación y login de usuarios (`supabase-client.js`).
- Carga inicial de datos (`connectCloud` → `dataStore.syncAllTables`).
- Sincronización CRUD básica de productos, clientes, ventas, etc. (`supabase-adapter.js` hace monkey-patching de `DataStore.prototype.add/update/delete`).
- Stock: `commitSaleStockOperation` llama a `decrement_stock` vía RPC.
- Puntos de fidelidad: `saveSaleRecord` llama a `add_loyalty_points` vía RPC.
- Pagos a crédito: `registerCreditPayment` usa `register_credit_payment` vía RPC.
- Realtime para sincronización entre cajas (`subscribeRealtimeAll`).

### Qué aún depende de Firestore / capa de compatibilidad

- `modules/data-store.js` contiene la lógica original de Firestore (`collection`, `doc`, `getDocs`, `onSnapshot`, `saveToSubcollections`).
- `modules/ui-controller.js` usa Firestore en funcionalidades secundarias: pedidos entrantes (`incoming_orders`), entregas (`deliveries`), pedidos públicos (`publicOrders`), chat web, resultados de entrenamiento y configuración de tienda pública.
- `modules/app-controller.js` también referencia Firestore para licencias y tenants en modo legacy.
- `modules/firebase-compat.js` es un stub que evita que el código legacy falle al cargar.
- `modules/firestore-compat.js` traduce llamadas Firestore a Supabase, pero no cubre todas las funcionalidades.

### Conclusión

El POS **puede funcionar** para el flujo principal de ventas y catálogo gracias a `supabase-adapter.js`, pero no es una adaptación nativa. Una reescritura completa implicaría reemplazar `data-store.js` y `ui-controller.js` por módulos diseñados directamente para Supabase.

## Próximos pasos recomendados

1. [ ] Decidir si se mantiene la arquitectura híbrida (adapter + compat) o se reescribe `software.html` nativamente para Supabase.
2. [ ] Si se mantiene híbrido: migrar las funcionalidades de Firestore restantes (pedidos, entregas, chat, training) a Supabase vía `firestore-compat.js` o nuevas RPC.
3. [ ] Migrar `crm-client-app.html` a Supabase.
4. [ ] Crear script de migración de datos de Firebase.
5. [ ] Testing offline/online completo.

## Soporte

- Supabase Docs: https://supabase.com/docs
- Realtime: https://supabase.com/docs/guides/realtime
- Auth: https://supabase.com/docs/guides/auth
- Row Level Security: https://supabase.com/docs/guides/auth/row-level-security
