-- 1. sessions
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expiresat_check" CHECK ("expiresAt" > "createdAt");

-- 2. business_settings
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_defaultduedays_check" CHECK ("defaultDueDays" >= 0 AND "defaultDueDays" <= 365);
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_singletonkey_check" CHECK ("singletonKey" = 'DEFAULT');
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_invoiceprefix_check" CHECK (char_length("invoicePrefix") BETWEEN 1 AND 5);

-- 3. clients
ALTER TABLE "clients" ADD CONSTRAINT "clients_isarchived_check" CHECK (
  ("isArchived" = false AND "archivedAt" IS NULL) OR
  ("isArchived" = true AND "archivedAt" IS NOT NULL)
);

-- 4. invoices
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_duedate_check" CHECK ("dueDate" >= "invoiceDate");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_financials_positive_check" CHECK (
  "subtotal" >= 0 AND "discountTotal" >= 0 AND "taxableTotal" >= 0 AND
  "cgstTotal" >= 0 AND "sgstTotal" >= 0 AND "igstTotal" >= 0 AND
  "total" >= 0 AND "paidAmount" >= 0 AND "outstandingAmount" >= 0
);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_discount_check" CHECK ("discountTotal" <= "subtotal");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_total_match_check" CHECK ("paidAmount" + "outstandingAmount" = "total");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_snapshot_version_check" CHECK ("snapshotVersion" >= 1);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lifecycle_check" CHECK (
  ("status" = 'DRAFT' AND "invoiceNumber" IS NULL AND "financialYear" IS NULL AND "sentAt" IS NULL AND "businessSnapshot" IS NULL AND "clientSnapshot" IS NULL AND "cancelledAt" IS NULL AND "cancellationReason" IS NULL) OR
  ("status" IN ('SENT', 'PARTIALLY_PAID', 'PAID') AND "invoiceNumber" IS NOT NULL AND "financialYear" IS NOT NULL AND "sentAt" IS NOT NULL AND "businessSnapshot" IS NOT NULL AND "clientSnapshot" IS NOT NULL AND "cancelledAt" IS NULL AND "cancellationReason" IS NULL) OR
  ("status" = 'CANCELLED' AND "invoiceNumber" IS NOT NULL AND "financialYear" IS NOT NULL AND "sentAt" IS NOT NULL AND "businessSnapshot" IS NOT NULL AND "clientSnapshot" IS NOT NULL AND "cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL)
);

-- 5. invoice_items
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_numeric_check" CHECK (
  "lineNumber" > 0 AND "quantity" > 0 AND "rate" >= 0 AND
  "discountAmount" >= 0 AND "taxableAmount" >= 0 AND
  "gstRate" >= 0 AND "gstRate" <= 100 AND
  "cgstAmount" >= 0 AND "sgstAmount" >= 0 AND "igstAmount" >= 0 AND "totalAmount" >= 0
);

-- 6. invoice_counters
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_sequence_check" CHECK ("nextSequence" BETWEEN 1 AND 10000);
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_prefix_check" CHECK (char_length("prefix") BETWEEN 1 AND 5);
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_financialyear_check" CHECK ("financialYear" ~ '^[0-9]{2}-[0-9]{2}$');

-- 7. payments
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("amount" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_check" CHECK (
  ("status" = 'RECORDED' AND "reversedAt" IS NULL AND "reversalReason" IS NULL) OR
  ("status" = 'REVERSED' AND "reversedAt" IS NOT NULL AND "reversalReason" IS NOT NULL)
);

-- 8. email_deliveries
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_attempt_check" CHECK ("attemptNumber" > 0);
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_status_check" CHECK (
  ("status" = 'PENDING' AND "acceptedAt" IS NULL AND "failedAt" IS NULL) OR
  ("status" = 'ACCEPTED' AND "acceptedAt" IS NOT NULL AND "failedAt" IS NULL) OR
  ("status" = 'FAILED' AND "failedAt" IS NOT NULL AND "acceptedAt" IS NULL)
);

-- Trigger Functions
CREATE OR REPLACE FUNCTION protect_financial_record_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of financial records is prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are append-only and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_invoice_item_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_status "InvoiceStatus";
BEGIN
  SELECT "status" INTO v_invoice_status
  FROM public."invoices"
  WHERE "id" = OLD."invoiceId"
  FOR SHARE;

  IF v_invoice_status != 'DRAFT' THEN
    RAISE EXCEPTION 'InvoiceItem mutation is prohibited when parent invoice is not DRAFT.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."invoiceId" != NEW."invoiceId" THEN
    SELECT "status" INTO v_invoice_status
    FROM public."invoices"
    WHERE "id" = NEW."invoiceId"
    FOR SHARE;

    IF v_invoice_status != 'DRAFT' THEN
      RAISE EXCEPTION 'Cannot move InvoiceItem to an invoice that is not DRAFT.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER protect_invoices_delete
BEFORE DELETE ON "invoices"
FOR EACH ROW EXECUTE FUNCTION protect_financial_record_delete();

CREATE TRIGGER protect_payments_delete
BEFORE DELETE ON "payments"
FOR EACH ROW EXECUTE FUNCTION protect_financial_record_delete();

CREATE TRIGGER protect_email_deliveries_delete
BEFORE DELETE ON "email_deliveries"
FOR EACH ROW EXECUTE FUNCTION protect_financial_record_delete();

CREATE TRIGGER protect_audit_logs_mutation
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION protect_audit_log_mutation();

CREATE TRIGGER protect_invoice_items_mutation
BEFORE UPDATE OR DELETE ON "invoice_items"
FOR EACH ROW EXECUTE FUNCTION protect_invoice_item_mutation();
