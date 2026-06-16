-- ============================================================
-- MIGRACIÓN: Tabla pending_tickets
-- ============================================================
-- Crea tabla para almacenar tickets pausados en POS
-- que se sincronizan con el backend Supabase

CREATE TABLE IF NOT EXISTS pending_tickets (
    id TEXT PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    ticket_num INTEGER,
    cart JSONB DEFAULT '[]'::jsonb,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    pos_note TEXT,
    seller TEXT,
    created_at BIGINT,
    updated_at TIMESTAMP DEFAULT NOW(),
    synced_at TIMESTAMP,
    is_archived BOOLEAN DEFAULT false
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_pending_tickets_tenant ON pending_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pending_tickets_client ON pending_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_pending_tickets_created ON pending_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_tickets_archived ON pending_tickets(is_archived);

-- ============================================================
-- RLS POLICIES - SEGURIDAD
-- ============================================================

ALTER TABLE pending_tickets ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver sus propios tickets del tenant
CREATE POLICY "Users can view pending tickets in their tenant"
    ON pending_tickets FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );

-- Los usuarios pueden crear tickets en su tenant
CREATE POLICY "Users can insert pending tickets in their tenant"
    ON pending_tickets FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );

-- Los usuarios pueden actualizar tickets en su tenant
CREATE POLICY "Users can update pending tickets in their tenant"
    ON pending_tickets FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );

-- Los usuarios pueden eliminar tickets en su tenant
CREATE POLICY "Users can delete pending tickets in their tenant"
    ON pending_tickets FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================

COMMENT ON TABLE pending_tickets IS 'Tickets pausados en POS que se sincronizan con Supabase';
COMMENT ON COLUMN pending_tickets.id IS 'ID único del ticket (formato: pending_TIMESTAMP)';
COMMENT ON COLUMN pending_tickets.tenant_id IS 'Identificador del tenant/empresa';
COMMENT ON COLUMN pending_tickets.ticket_num IS 'Número de boleta/ticket';
COMMENT ON COLUMN pending_tickets.cart IS 'Array de productos en el carrito (JSON)';
COMMENT ON COLUMN pending_tickets.client_id IS 'ID del cliente (opcional)';
COMMENT ON COLUMN pending_tickets.discount IS 'Descuento aplicado';
COMMENT ON COLUMN pending_tickets.pos_note IS 'Notas del punto de venta';
COMMENT ON COLUMN pending_tickets.seller IS 'Vendedor que pausó el ticket';
COMMENT ON COLUMN pending_tickets.created_at IS 'Timestamp de creación en cliente (milisegundos)';
COMMENT ON COLUMN pending_tickets.updated_at IS 'Timestamp de última actualización en servidor';
COMMENT ON COLUMN pending_tickets.synced_at IS 'Timestamp del último sincronismo exitoso';
COMMENT ON COLUMN pending_tickets.is_archived IS 'Bandera para archivar/eliminar lógico';
