# Statement of Applicability (SOA) — RIVER-WALL PRO v3.3
## ISO/IEC 27001:2022 Annex A Controls

| Control ID | Control Name | Applicable | Status | Evidence |
|------------|-------------|-----------|--------|----------|
| **A.5.1** | Information security policies | ✅ | Implemented | `docs/security/policy.md` |
| **A.5.2** | Information security roles | ✅ | Implemented | RBAC in `security-utils.js` |
| **A.6.1** | Internal organization | ✅ | Documented | Org chart in policy |
| **A.6.2** | Mobile devices | ✅ | N/A (PWA only) | Service Worker in `sw.js` |
| **A.6.3** | Teleworking | ❌ | N/A | On-premise POS system |
| **A.7.1** | Screening | ❌ | HR policy | Out of scope |
| **A.7.2** | Employment terms | ❌ | HR policy | Out of scope |
| **A.8.1** | Asset inventory | ✅ | Documented | Codebase + Supabase infra |
| **A.8.2** | Information classification | ✅ | Implemented | PII classification in `security-utils.js` |
| **A.8.3** | Media handling | ❌ | N/A | Cloud-only |
| **A.8.4** | Asset return | ❌ | N/A | Out of scope |
| **A.8.5** | Disposal of assets | ❌ | N/A | Out of scope |
| **A.8.6** | Secure disposal | ❌ | N/A | Out of scope |
| **A.8.7** | Removal of assets | ❌ | N/A | Out of scope |
| **A.8.8** | Asset management | ✅ | Implemented | Version control in env.js |
| **A.8.9** | Acceptable use | ✅ | Documented | Policy |
| **A.8.10** | Return of assets | ❌ | N/A | Out of scope |
| **A.8.11** | Asset labeling | ✅ | Implemented | Code comments |
| **A.8.12** | Asset handling | ✅ | Implemented | PII redaction |
| **A.8.13** | Asset transfer | ❌ | N/A | Out of scope |
| **A.8.14** | Outsourcing | ❌ | N/A | Out of scope |
| **A.9.1** | Business requirements | ✅ | Implemented | RBAC in `security-utils.js` |
| **A.9.2** | User access provisioning | ✅ | Implemented | `AuthManager` in `supabase-client.js` |
| **A.9.3** | Access control review | ✅ | Periodic | Manual review process |
| **A.9.4** | Authentication methods | ✅ | Implemented | 2FA TOTP + password in `security-utils.js` |
| **A.9.5** | Privileged access | ✅ | Implemented | Superadmin role + RLS |
| **A.10.1** | Cryptographic controls | ✅ | Implemented | AES-GCM in `security-utils.js` |
| **A.10.2** | Key management | ✅ | Implemented | PBKDF2 key derivation |
| **A.11.1** | Physical security | ❌ | N/A | Cloud infrastructure |
| **A.11.2** | Equipment | ❌ | N/A | User-owned devices |
| **A.12.1** | Operational procedures | ✅ | Documented | `README.md` + runbooks |
| **A.12.2** | Malware protection | ✅ | CSP | Content-Security-Policy in all HTML |
| **A.12.3** | Backup | ✅ | Implemented | `disaster-recovery.js` + Supabase backups |
| **A.12.4** | Logging & monitoring | ✅ | Implemented | `audit_logs` table + `logAudit()` |
| **A.12.5** | Control of operational software | ✅ | Implemented | Version in `env.js` |
| **A.12.6** | Vulnerability management | ✅ | CSP + input sanitization | `sanitizeHtml()` in `security-utils.js` |
| **A.12.7** | Information systems audit | ✅ | Implemented | Audit trail + queue |
| **A.13.1** | Network security | ✅ | Implemented | `enforceHTTPS()` + WSS |
| **A.13.2** | Information transfer | ✅ | Implemented | postMessage origin validation |
| **A.13.3** | Electronic messaging | ❌ | N/A | Out of scope |
| **A.13.4** | Confidentiality agreements | ❌ | Legal | Out of scope |
| **A.14.1** | Secure development policy | ✅ | Implemented | SDLC documented |
| **A.14.2** | Secure development | ✅ | Implemented | All code controls |
| **A.14.3** | Test data | ✅ | Implemented | Demo mode |
| **A.15.1** | Supplier relationships | ❌ | N/A | Supabase SOC 2 compliant |
| **A.15.2** | Supplier service delivery | ❌ | N/A | Supabase SLA |
| **A.16.1** | Incident management | ✅ | Documented | IR plan |
| **A.17.1** | Business continuity | ✅ | Implemented | `disaster-recovery.js` |
| **A.17.2** | IT readiness | ✅ | Implemented | Offline-first architecture |
| **A.18.1** | Compliance | ✅ | Documented | This SOA |
| **A.18.2** | Intellectual property | ✅ | Licensed | Proprietary |
