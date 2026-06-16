# Risk Assessment Report — RIVER-WALL PRO v3.3

## Methodology
- **Asset-based risk assessment** (ISO 27001 clause 6.1.3)
- Likelihood: 1-5 (rare to almost certain)
- Impact: 1-5 (minor to catastrophic)
- Risk level: Low (1-6), Medium (7-12), High (13-20), Critical (21-25)

## Asset Inventory

| Asset ID | Asset | Type | Owner | Location |
|----------|-------|------|-------|----------|
| A-001 | Source code | Software | Dev team | GitHub + local |
| A-002 | Supabase DB | Data | DBA | Supabase Cloud |
| A-003 | Client PII | Data | DPO | Supabase + localStorage |
| A-004 | Credentials | Data | Security | localStorage (encrypted) |
| A-005 | POS sales data | Data | Ops | Supabase + local cache |
| A-006 | Service Worker | Software | Dev | Browser cache |
| A-007 | Offline queue | Data | Dev | localStorage |
| A-008 | Audit logs | Data | Security | Supabase + local |

## Risk Register

### Critical Risks

| ID | Risk | Asset | Likelihood | Impact | Score | Mitigation | Residual |
|----|------|-------|-----------|-------|-------|------------|----------|
| R-01 | SQL injection via RPC | A-002 | 2 | 5 | 10 | Input validation in all RPCs + parameterized queries | 4 |
| R-02 | XSS via product descriptions | A-003 | 3 | 4 | 12 | CSP + sanitizeHtml() + enableSafeDOM() | 5 |
| R-03 | Offline data desync (conflict) | A-007 | 3 | 3 | 9 | Timestamp-based conflict resolution | 4 |
| R-04 | localStorage PII exposure | A-003 | 2 | 4 | 8 | AES-GCM encryption + secureSetItem() | 3 |
| R-05 | Brute force PIN attack | A-004 | 3 | 3 | 9 | Account lockout after 5 attempts | 4 |

### High Risks

| ID | Risk | Asset | Likelihood | Impact | Score | Mitigation | Residual |
|----|------|-------|-----------|-------|-------|------------|----------|
| R-06 | Man-in-the-middle on HTTP | A-002 | 1 | 5 | 5 | enforceHTTPS() + HSTS via CSP | 2 |
| R-07 | Session hijacking | A-004 | 2 | 4 | 8 | Session timeout 15min + secure storage | 3 |
| R-08 | Unauthorized access via postMessage | A-003 | 2 | 4 | 8 | Origin validation in all listeners | 3 |
| R-09 | Data loss from sync queue failure | A-007 | 2 | 4 | 8 | Retry with backoff (5 attempts) | 3 |
| R-10 | RLS bypass in Supabase | A-002 | 1 | 5 | 5 | RLS on all tables + SECURITY DEFINER review | 2 |

### Medium Risks

| ID | Risk | Asset | Likelihood | Impact | Score | Mitigation | Residual |
|----|------|-------|-----------|-------|-------|------------|----------|
| R-11 | CSP bypass via JSONP | A-006 | 2 | 3 | 6 | CSP with 'strict-dynamic' where possible | 3 |
| R-12 | LocalStorage quota exceeded | A-007 | 3 | 2 | 6 | Cache pruning (oldest 20%) | 3 |
| R-13 | Offline auth hash collision | A-004 | 1 | 3 | 3 | SHA-256 + salt | 1 |
| R-14 | Service worker cache poisoning | A-006 | 1 | 4 | 4 | Cache-first only for CDN resources | 2 |
| R-15 | 2FA bypass via localStorage tampering | A-004 | 1 | 3 | 3 | Server-side verification recommended | 2 |

## Risk Treatment Plan

### Accepted Risks (low residual)
- R-06: HTTPS enforcement sufficient for current threat model
- R-10: Supabase RLS + tenant isolation accepted
- R-13: SHA-256 adequate for offline auth fallback

### Mitigated Risks (controls implemented)
- R-01 through R-15: All mitigated per Fase 1 implementation

### Transferred Risks
- Infrastructure security: Supabase SOC 2 compliance
- Legal compliance: Client's legal team

## Residual Risk Statement
After implementing all Phase 1 controls, the residual risk level is **ACCEPTABLE** for the current threat model (small-to-medium retail businesses in Central Africa). Critical recommendation: implement server-side 2FA verification and annual penetration testing.

---
*Assessment Date: 2026-06-13 | Next Review: 2026-12-13*
