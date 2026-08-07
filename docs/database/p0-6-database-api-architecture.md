# InvoiceFlow P0.6-R1 — Database/API Architecture Contract

**Status:** RECOVERY BASELINE — PENDING BOSS APPROVAL  
**Replaces:** Missing original P0.6 Database/API Architecture artifact  
**Project:** InvoiceFlow  
**Scope:** Database contract, persistence boundaries and API data rules  
**Implementation:** NOT AUTHORIZED BY THIS DOCUMENT ALONE

## Authority

The original P0.6 artifact was approved conceptually during Phase 0 but was never committed to the repository.

This document reconstructs and freezes the database/API architecture required by the currently approved InvoiceFlow roadmap.

After explicit Boss approval, this document becomes the authoritative P0.6 schema contract for P2 implementation.

No implementation may silently add, remove, rename or reinterpret fields, enums, relationships, constraints or financial semantics defined here.

## 1. SYSTEM ARCHITECTURE BOUNDARY

InvoiceFlow uses:
- Node.js 24
- TypeScript
- Express
- PostgreSQL
- Prisma ORM
- Zod
- pnpm monorepo

Database: PostgreSQL
ORM: Prisma

**Database access rule:**
Controllers MUST NOT access Prisma directly.
Services MUST NOT scatter raw PrismaClient construction.
Database access must flow through the approved repository/database layer.
One centralized Prisma runtime foundation must be used.

## 2. CORE DATABASE RULES

### Rule 1 — Never use floating point for money
All monetary values use PostgreSQL `NUMERIC(12,2)`
Prisma representation: `Decimal`
Never use Float, Double, or JavaScript Number as the authoritative financial representation.
`NUMERIC(12,2)` supports values up to 9,999,999,999.99 which is sufficient for the InvoiceFlow MVP.

### Rule 2 — Never hard-delete issued financial records

The following must never be permanently deleted through normal application behaviour:
- Invoice
- Payment
- EmailDelivery
- AuditLog
- InvoiceItem once its parent Invoice has left DRAFT

InvoiceItem rows MAY be deleted while the parent Invoice remains DRAFT.
Once the parent Invoice leaves DRAFT, its InvoiceItem records become retained financial records and cannot be updated or deleted except through an explicitly approved future correction workflow.

Clients use archive/soft-delete behaviour.
Users use deactivate/reactivate behaviour.
Sessions may be expired/revoked and later cleaned according to an approved retention policy.

### Rule 3 — Store calculated financial values
Calculated invoice values are computed authoritatively by the backend and stored.
Examples: subtotal, discount total, taxable total, CGST, SGST, IGST, grand total.
They must not be historically reconstructed from mutable client/business records.

### Rule 4 — Financial rounding
Application financial calculations use: `ROUND_HALF_UP`
The database stores the resulting exact decimal values.

### Rule 5 — Financial writes are transactional
Operations affecting invoice numbering, invoice totals, invoice state, payments, and financial audit records must be capable of executing atomically in PostgreSQL transactions.

## 3. IDENTIFIER POLICY

Application-domain primary keys use UUID.
Prisma: `String @id @default(uuid()) @db.Uuid`
Do not use sequential public IDs for core resources.
Invoice human-readable numbers are separate business identifiers.

## 4. TIME POLICY

Technical timestamps use PostgreSQL: `timestamptz`
Examples: createdAt, updatedAt, sentAt, paidAt, revokedAt.

Business calendar dates use PostgreSQL `DATE` where a time-of-day is not semantically required.
Examples: invoiceDate, dueDate.

All API timestamps are ISO-8601 UTC strings.

## 5. CORE MODEL INVENTORY

P2 must contain exactly these core models:
1. User
2. Session
3. BusinessSettings
4. Client
5. Invoice
6. InvoiceItem
7. InvoiceCounter
8. Payment
9. EmailDelivery
10. AuditLog

Do not add Organization/Tenant/Product/Subscription models in P2.

## 6. ENUMS

### UserRole
Exact values: `SUPER_ADMIN`, `STAFF`, `VIEWER`
- SUPER_ADMIN: Full administrative authority.
- STAFF: Operational access assigned in later RBAC implementation.
- VIEWER: Read-oriented access assigned in later RBAC implementation.

### InvoiceStatus
Exact persisted values: `DRAFT`, `SENT`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`

OVERDUE is derived, never persisted.
OVERDUE is true only when:
- dueDate < current business date
- AND status IN (SENT, PARTIALLY_PAID)
- AND outstandingAmount > 0

A DRAFT invoice must never be classified as OVERDUE.
PAID and CANCELLED invoices must never be classified as OVERDUE.

### PaymentMethod
Exact values: `CASH`, `BANK_TRANSFER`, `UPI`, `CHEQUE`, `OTHER`

### PaymentStatus
Exact values: `RECORDED`, `REVERSED`
Payment rows remain retained permanently. A reversal does not delete or overwrite historical payment identity.

### EmailDeliveryStatus
Exact values: `PENDING`, `ACCEPTED`, `FAILED`

## 7. CORE MODELS

### MODEL — User
Table: `users`
- id: UUID PRIMARY KEY
- email: varchar(320) NOT NULL UNIQUE
- passwordHash: varchar(255) NOT NULL
- firstName: varchar(100) NOT NULL
- lastName: varchar(100) NOT NULL
- role: UserRole NOT NULL DEFAULT VIEWER
- isActive: boolean NOT NULL DEFAULT true
- lastLoginAt: timestamptz NULL
- createdAt: timestamptz NOT NULL DEFAULT now()
- updatedAt: timestamptz NOT NULL
**Rules:** Normal application flows do not hard-delete users.
**Indexes:** UNIQUE(email), INDEX(role), INDEX(isActive)

### MODEL — Session
Table: `sessions`
- id: UUID PRIMARY KEY
- userId: UUID NOT NULL (FK -> users.id, ON DELETE RESTRICT, ON UPDATE CASCADE)
- tokenHash: varchar(255) NOT NULL UNIQUE
- familyId: UUID NOT NULL
- expiresAt: timestamptz NOT NULL
- revokedAt: timestamptz NULL
- revocationReason: varchar(100) NULL
- lastUsedAt: timestamptz NULL
- userAgent: varchar(500) NULL
- ipAddress: varchar(64) NULL
- createdAt: timestamptz NOT NULL DEFAULT now()
**Rules:** Raw refresh tokens are NEVER stored.
**Indexes:** UNIQUE(tokenHash), INDEX(userId), INDEX(familyId), INDEX(expiresAt), INDEX(userId, revokedAt)
**Constraint:** expiresAt > createdAt

### MODEL — BusinessSettings
Table: `business_settings`
- id: UUID PRIMARY KEY
- singletonKey: varchar(20) NOT NULL DEFAULT 'DEFAULT' UNIQUE
- legalName: varchar(200) NOT NULL
- displayName: varchar(200) NOT NULL
- gstin: varchar(15) NULL
- pan: varchar(10) NULL
- addressLine1: varchar(200) NOT NULL
- addressLine2: varchar(200) NULL
- city: varchar(100) NOT NULL
- state: varchar(100) NOT NULL
- stateCode: varchar(2) NOT NULL
- postalCode: varchar(10) NOT NULL
- country: varchar(100) NOT NULL DEFAULT 'India'
- email: varchar(320) NULL
- phone: varchar(30) NULL
- logoStorageKey: varchar(500) NULL
- invoicePrefix: varchar(5) NOT NULL DEFAULT 'INV'
- defaultDueDays: integer NOT NULL DEFAULT 15
- bankAccountName: varchar(200) NULL
- bankAccountNumber: varchar(50) NULL
- bankName: varchar(200) NULL
- bankIfsc: varchar(20) NULL
- upiId: varchar(100) NULL
- createdAt: timestamptz NOT NULL DEFAULT now()
- updatedAt: timestamptz NOT NULL
**Rules:** 
- The combination of CHECK + UNIQUE permits at most one BusinessSettings row. Do not create Organization/Tenant architecture.
- Security: The business bank account number is payment-display information required for approved invoice/payment instructions. It may be rendered only in approved invoice/payment contexts. It MUST be redacted from application logs, error payloads, and debug output.
- Never store: banking password, PIN, OTP, internet-banking credential, card CVV, or other authentication secret.
**Constraints:**
- defaultDueDays >= 0, defaultDueDays <= 365
- CHECK (singletonKey = 'DEFAULT')
- CHECK (char_length(invoicePrefix) BETWEEN 1 AND 5)
**Unique:** singletonKey

### MODEL — Client
Table: `clients`
- id: UUID PRIMARY KEY
- name: varchar(200) NOT NULL
- email: varchar(320) NULL
- phone: varchar(30) NULL
- gstin: varchar(15) NULL
- pan: varchar(10) NULL
- addressLine1: varchar(200) NOT NULL
- addressLine2: varchar(200) NULL
- city: varchar(100) NOT NULL
- state: varchar(100) NOT NULL
- stateCode: varchar(2) NOT NULL
- postalCode: varchar(10) NOT NULL
- country: varchar(100) NOT NULL DEFAULT 'India'
- notes: text NULL
- isArchived: boolean NOT NULL DEFAULT false
- archivedAt: timestamptz NULL
- createdByUserId: UUID NULL (FK -> users.id, ON DELETE SET NULL, ON UPDATE CASCADE)
- createdAt: timestamptz NOT NULL DEFAULT now()
- updatedAt: timestamptz NOT NULL
**Rules:** Clients are never normally hard deleted.
**Constraint:** (isArchived = false AND archivedAt IS NULL) OR (isArchived = true AND archivedAt IS NOT NULL)
**Indexes:** INDEX(name), INDEX(email), INDEX(isArchived), INDEX(stateCode), INDEX(createdAt)

### MODEL — Invoice
Table: `invoices`
- id: UUID PRIMARY KEY
- clientId: UUID NOT NULL (FK -> clients.id, ON DELETE RESTRICT, ON UPDATE CASCADE)
- invoiceNumber: varchar(16) NULL UNIQUE
- financialYear: varchar(5) NULL
- status: InvoiceStatus NOT NULL DEFAULT DRAFT
- invoiceDate: date NOT NULL
- dueDate: date NOT NULL
- currency: char(3) NOT NULL DEFAULT 'INR'
- placeOfSupplyState: varchar(100) NOT NULL
- placeOfSupplyStateCode: varchar(2) NOT NULL
- notes: text NULL
- terms: text NULL
- subtotal: numeric(12,2) NOT NULL DEFAULT 0
- discountTotal: numeric(12,2) NOT NULL DEFAULT 0
- taxableTotal: numeric(12,2) NOT NULL DEFAULT 0
- cgstTotal: numeric(12,2) NOT NULL DEFAULT 0
- sgstTotal: numeric(12,2) NOT NULL DEFAULT 0
- igstTotal: numeric(12,2) NOT NULL DEFAULT 0
- total: numeric(12,2) NOT NULL DEFAULT 0
- paidAmount: numeric(12,2) NOT NULL DEFAULT 0
- outstandingAmount: numeric(12,2) NOT NULL DEFAULT 0
- snapshotVersion: integer NOT NULL DEFAULT 1
- businessSnapshot: jsonb NULL
- clientSnapshot: jsonb NULL
- sentAt: timestamptz NULL
- cancelledAt: timestamptz NULL
- cancellationReason: varchar(500) NULL
- createdByUserId: UUID NULL (FK -> users.id, ON DELETE SET NULL, ON UPDATE CASCADE)
- sentByUserId: UUID NULL (FK -> users.id, ON DELETE SET NULL, ON UPDATE CASCADE)
- createdAt: timestamptz NOT NULL DEFAULT now()
- updatedAt: timestamptz NOT NULL
**Rules:** 
- invoiceNumber is NULL while DRAFT, allocated atomically when DRAFT -> SENT.
- Generated invoiceNumber must never exceed 16 characters.
- Cancellation is a lifecycle operation on an already-issued/sent invoice. Silently cancelling an unissued DRAFT is prohibited.
**Constraints:**
- dueDate >= invoiceDate
- subtotal >= 0, discountTotal >= 0, taxableTotal >= 0, cgstTotal >= 0, sgstTotal >= 0, igstTotal >= 0, total >= 0, paidAmount >= 0, outstandingAmount >= 0
- discountTotal <= subtotal
- paidAmount + outstandingAmount = total
- snapshotVersion >= 1
- For DRAFT:
  - invoiceNumber IS NULL
  - financialYear IS NULL
  - sentAt IS NULL
  - businessSnapshot IS NULL
  - clientSnapshot IS NULL
  - cancelledAt IS NULL
  - cancellationReason IS NULL
- For SENT/PARTIALLY_PAID/PAID:
  - invoiceNumber IS NOT NULL
  - financialYear IS NOT NULL
  - sentAt IS NOT NULL
  - businessSnapshot IS NOT NULL
  - clientSnapshot IS NOT NULL
  - cancelledAt IS NULL
  - cancellationReason IS NULL
- For CANCELLED:
  - invoiceNumber IS NOT NULL
  - financialYear IS NOT NULL
  - sentAt IS NOT NULL
  - businessSnapshot IS NOT NULL
  - clientSnapshot IS NOT NULL
  - cancelledAt IS NOT NULL
  - cancellationReason IS NOT NULL
**Indexes:** UNIQUE(invoiceNumber), INDEX(clientId), INDEX(status), INDEX(invoiceDate), INDEX(dueDate), INDEX(financialYear), INDEX(createdAt), INDEX(status, dueDate)

### MODEL — InvoiceItem
Table: `invoice_items`
- id: UUID PRIMARY KEY
- invoiceId: UUID NOT NULL (FK -> invoices.id, ON DELETE RESTRICT, ON UPDATE CASCADE)
- lineNumber: integer NOT NULL
- description: varchar(500) NOT NULL
- sacCode: varchar(20) NULL
- quantity: numeric(12,3) NOT NULL
- rate: numeric(12,2) NOT NULL
- discountAmount: numeric(12,2) NOT NULL DEFAULT 0
- taxableAmount: numeric(12,2) NOT NULL
- gstRate: numeric(5,2) NOT NULL
- cgstAmount: numeric(12,2) NOT NULL DEFAULT 0
- sgstAmount: numeric(12,2) NOT NULL DEFAULT 0
- igstAmount: numeric(12,2) NOT NULL DEFAULT 0
- totalAmount: numeric(12,2) NOT NULL
- createdAt: timestamptz NOT NULL DEFAULT now()
- updatedAt: timestamptz NOT NULL
**Rules:**
- InvoiceItem hard deletion is permitted ONLY while the parent Invoice is DRAFT.
- Once the parent invoice has transitioned out of DRAFT:
  - InvoiceItem UPDATE: PROHIBITED except through an explicitly approved future correction workflow.
  - InvoiceItem DELETE: PROHIBITED.
- P2 MUST enforce issued-item immutability using an appropriate PostgreSQL trigger or equivalent database mechanism.
**Constraints:** lineNumber > 0, quantity > 0, rate >= 0, discountAmount >= 0, taxableAmount >= 0, gstRate >= 0 AND gstRate <= 100, cgstAmount >= 0, sgstAmount >= 0, igstAmount >= 0, totalAmount >= 0
**Unique:** UNIQUE(invoiceId, lineNumber)
**Index:** INDEX(invoiceId)

### MODEL — InvoiceCounter
Table: `invoice_counters`
- id: UUID PRIMARY KEY
- financialYear: varchar(5) NOT NULL
- prefix: varchar(5) NOT NULL DEFAULT 'INV'
- nextSequence: integer NOT NULL DEFAULT 1
- createdAt: timestamptz NOT NULL DEFAULT now()
- updatedAt: timestamptz NOT NULL
**Rules:**
- financialYear format: `YY-YY` (Example: `26-27`)
- Sequence is exactly four digits.
- Invoice format: `<PREFIX>/<YY-YY>/<NNNN>` (Example: `INV/26-27/0001`). 
- Valid sequence range: `0001` through `9999`. Maximum invoices per prefix per financial year is 9999.
- Invoice number must remain within `varchar(16)`.
- P2 must NOT implement the atomic allocator service.
**Unique:** UNIQUE(financialYear, prefix)
**Constraints:** 
- CHECK (nextSequence BETWEEN 1 AND 10000)
- Semantics: 1..9999 = valid next sequence, 10000 = sequence exhausted sentinel. P5 MUST refuse invoice-number allocation when nextSequence = 10000.
- CHECK (char_length(prefix) BETWEEN 1 AND 5)
- Mandatory PostgreSQL validation: financialYear must match `^[0-9]{2}-[0-9]{2}$`

### MODEL — Payment
Table: `payments`
- id: UUID PRIMARY KEY
- invoiceId: UUID NOT NULL (FK -> invoices.id, ON DELETE RESTRICT, ON UPDATE CASCADE)
- amount: numeric(12,2) NOT NULL
- method: PaymentMethod NOT NULL
- status: PaymentStatus NOT NULL DEFAULT RECORDED
- reference: varchar(200) NULL
- notes: varchar(500) NULL
- idempotencyKey: varchar(255) NULL UNIQUE
- paidAt: timestamptz NOT NULL
- recordedByUserId: UUID NULL (FK -> users.id, ON DELETE SET NULL, ON UPDATE CASCADE)
- reversedAt: timestamptz NULL
- reversedByUserId: UUID NULL (FK -> users.id, ON DELETE SET NULL, ON UPDATE CASCADE)
- reversalReason: varchar(500) NULL
- createdAt: timestamptz NOT NULL DEFAULT now()
**Constraints:** amount > 0, If RECORDED: reversedAt IS NULL, reversalReason IS NULL. If REVERSED: reversedAt IS NOT NULL, reversalReason IS NOT NULL.
**Indexes:** INDEX(invoiceId), INDEX(paidAt), INDEX(invoiceId, paidAt), INDEX(status)

### MODEL — EmailDelivery
Table: `email_deliveries`
- id: UUID PRIMARY KEY
- invoiceId: UUID NOT NULL (FK -> invoices.id, ON DELETE RESTRICT, ON UPDATE CASCADE)
- recipientEmail: varchar(320) NOT NULL
- status: EmailDeliveryStatus NOT NULL DEFAULT PENDING
- provider: varchar(50) NULL
- providerMessageId: varchar(255) NULL UNIQUE
- attemptNumber: integer NOT NULL DEFAULT 1
- attemptedAt: timestamptz NOT NULL DEFAULT now()
- acceptedAt: timestamptz NULL
- failedAt: timestamptz NULL
- failureCode: varchar(100) NULL
- failureMessage: varchar(500) NULL
- createdAt: timestamptz NOT NULL DEFAULT now()
**Constraints:**
- attemptNumber > 0
- If status = PENDING: acceptedAt IS NULL, failedAt IS NULL
- If status = ACCEPTED: acceptedAt IS NOT NULL, failedAt IS NULL
- If status = FAILED: failedAt IS NOT NULL, acceptedAt IS NULL
**Indexes:** INDEX(invoiceId), INDEX(status), INDEX(recipientEmail), INDEX(attemptedAt)

### MODEL — AuditLog
Table: `audit_logs` (append-only)
- id: UUID PRIMARY KEY
- actorUserId: UUID NULL (FK -> users.id, ON DELETE RESTRICT, ON UPDATE RESTRICT)
- action: varchar(100) NOT NULL
- entityType: varchar(100) NOT NULL
- entityId: UUID NULL
- requestId: varchar(100) NULL
- metadata: jsonb NULL
- ipAddress: varchar(64) NULL
- userAgent: varchar(500) NULL
- createdAt: timestamptz NOT NULL DEFAULT now()
**Rules:** 
- INSERT permitted, SELECT permitted.
- UPDATE prohibited, DELETE prohibited.
- P2 MUST enforce PostgreSQL enforcement appropriate to the selected runtime role/trigger architecture so that "append-only" is not merely a comment.
- Do not implement application audit event generation in P2.
**Indexes:** INDEX(actorUserId), INDEX(action), INDEX(entityType, entityId), INDEX(createdAt), INDEX(entityType, entityId, createdAt)

## 8. FINANCIAL RECORD DATABASE PROTECTION

P2 MUST enforce at PostgreSQL level:

Invoice:
DELETE prohibited.

Payment:
DELETE prohibited.

EmailDelivery:
DELETE prohibited.

AuditLog:
UPDATE prohibited.
DELETE prohibited.

InvoiceItem:
UPDATE permitted only while parent Invoice.status = DRAFT.
DELETE permitted only while parent Invoice.status = DRAFT.
Once parent Invoice leaves DRAFT:
InvoiceItem UPDATE prohibited.
InvoiceItem DELETE prohibited.

Use PostgreSQL triggers or an equivalently strong database mechanism.
These rules must not exist only in application code or documentation.
Database integration tests must prove every restriction.

## 9. INVOICE SNAPSHOT CONTRACT

Exact businessSnapshot version 1 shape:
```json
{
  "version": 1,
  "legalName": "string",
  "displayName": "string",
  "gstin": "string|null",
  "pan": "string|null",
  "addressLine1": "string",
  "addressLine2": "string|null",
  "city": "string",
  "state": "string",
  "stateCode": "string",
  "postalCode": "string",
  "country": "string",
  "email": "string|null",
  "phone": "string|null",
  "logoStorageKey": "string|null",
  "bankAccountName": "string|null",
  "bankAccountNumber": "string|null",
  "bankName": "string|null",
  "bankIfsc": "string|null",
  "upiId": "string|null"
}
```

Exact clientSnapshot version 1 shape:
```json
{
  "version": 1,
  "clientId": "uuid",
  "name": "string",
  "email": "string|null",
  "phone": "string|null",
  "gstin": "string|null",
  "pan": "string|null",
  "addressLine1": "string",
  "addressLine2": "string|null",
  "city": "string",
  "state": "string",
  "stateCode": "string",
  "postalCode": "string",
  "country": "string"
}
```

## 10. API DATA BOUNDARY

All API routes use: `/api/v1`
Database models are never returned directly as API contracts.
Controller flow: Router → Middleware → Controller → Service → Repository → Prisma/PostgreSQL.

**Decimal API Rule:** Every money value crosses API boundaries as a decimal STRING.
**Date API Rule:** DATE values: `YYYY-MM-DD`, Timestamp values: ISO-8601 UTC.

## 11. DATABASE TESTING AND MIGRATION

P2 creates a committed Prisma migration. Do not treat `prisma db push` as committed schema evolution.
Database integration tests must refuse to execute against a production database. (Requires `NODE_ENV=test` and `TEST_DATABASE_URL`).
Tests must use real PostgreSQL. No mocks for db logic.

## 12. IMPLEMENTATION BOUNDARY
This contract authorizes schema design AFTER Boss approval.
It does NOT authorize implementing: login, JWT, RBAC, API endpoints for clients/invoices, GST engine, email integration, payments, etc.
