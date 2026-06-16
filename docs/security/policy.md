# Política de Seguridad de la Información
## RIVER-WALL PRO v3.3

### 1. Objetivo
Establecer el marco de seguridad para proteger la confidencialidad, integridad y disponibilidad de los datos gestionados por RIVER-WALL PRO.

### 2. Alcance
Esta política aplica a todo el código fuente, datos de clientes, configuraciones de infraestructura y personal con acceso al sistema.

### 3. Principios

#### 3.1 Seguridad por Diseño
- Todo nuevo código debe incluir validación de inputs, escape de outputs y controles de acceso
- Las revisiones de código deben verificar ausencia de vulnerabilidades OWASP Top 10
- Los secretos (API keys, tokens) nunca deben hardcodearse en el código fuente

#### 3.2 Control de Acceso
- Principio de mínimo privilegio: cada usuario solo accede a lo necesario
- Roles definidos: viewer, seller, admin, superadmin
- 2FA obligatorio para superadmin
- Sesión expira tras 15 minutos de inactividad

#### 3.3 Cifrado
- Datos en tránsito: TLS 1.2+ (HTTPS/WSS forzado)
- Datos en reposo local: AES-256-GCM con PBKDF2
- PINs y contraseñas: hash SHA-256 mínimo, bcrypt recomendado

#### 3.4 Auditoría
- Toda operación CRUD debe registrarse en `audit_logs`
- Los logs de auditoría son inmutables (RSL: solo INSERT)
- Retención mínima: 90 días

#### 3.5 Protección de Datos
- Los datos personales (PII) deben identificarse y tratarse según su clasificación
- Los datos locales deben purgarse tras 90 días sin sincronizar
- Exportación/importación de datos disponible para disaster recovery

### 4. Roles y Responsabilidades

| Rol | Responsabilidades |
|-----|-------------------|
| **SuperAdmin** | Gestión de tenants, licencias, usuarios globales, 2FA |
| **Admin** | Gestión de negocio, usuarios locales, configuración |
| **Seller** | Ventas, clientes, inventario básico |
| **Viewer** | Solo lectura de reportes y catálogo |

### 5. Respuesta a Incidentes

1. **Detección**: Monitorización de audit_logs, alertas de sync queue atascada
2. **Contención**: Forzar logout de todas las sesiones, revocar tokens
3. **Erradicación**: Restaurar desde backup (ver `disaster-recovery.js`)
4. **Recuperación**: Re-sync desde Supabase
5. **Lecciones**: Actualizar risk assessment

### 6. Cumplimiento
- RGPD / LOPDGDD para datos de clientes en UE
- SOX para datos financieros
- ISO 27001 para SGSI

---
*Versión: 1.0 — Fecha: 2026-06-13*
