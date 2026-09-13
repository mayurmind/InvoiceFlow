import * as React from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Alert } from '../../../components/ui/alert';
import {
  INDIA_STATES_AND_UT,
  VALID_STATE_CODES,
  REGEX_PAN,
  REGEX_PIN,
  REGEX_IFSC,
  REGEX_UPI,
  REGEX_INVOICE_PREFIX,
} from '../constants/business-settings.constants';
import type {
  BusinessSettings,
  UpdateBusinessSettingsRequest,
} from '../types/business-settings.types';

interface BusinessSettingsFormProps {
  initialData: BusinessSettings;
  onSubmit: (data: UpdateBusinessSettingsRequest) => Promise<void>;
  isSubmitting: boolean;
}

export function BusinessSettingsForm({
  initialData,
  onSubmit,
  isSubmitting,
}: BusinessSettingsFormProps) {
  const [formData, setFormData] = React.useState<UpdateBusinessSettingsRequest>({
    legalName: initialData.legalName,
    displayName: initialData.displayName,
    gstin: initialData.gstin || '',
    pan: initialData.pan || '',
    addressLine1: initialData.addressLine1,
    addressLine2: initialData.addressLine2 || '',
    city: initialData.city,
    state: initialData.state,
    stateCode: initialData.stateCode,
    postalCode: initialData.postalCode,
    country: 'India',
    email: initialData.email || '',
    phone: initialData.phone || '',
    invoicePrefix: initialData.invoicePrefix,
    defaultDueDays: initialData.defaultDueDays,
    bankAccountName: initialData.bankAccountName || '',
    bankAccountNumber: initialData.bankAccountNumber || '',
    bankName: initialData.bankName || '',
    bankIfsc: initialData.bankIfsc || '',
    upiId: initialData.upiId || '',
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = React.useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      
      // Auto-fill state name when stateCode changes
      if (name === 'stateCode') {
        const stateObj = INDIA_STATES_AND_UT.find((s) => s.code === value);
        if (stateObj) {
          updated.state = stateObj.name;
        }
      }

      // Convert integers
      if (name === 'defaultDueDays') {
        updated.defaultDueDays = parseInt(value, 10) || 0;
      }

      return updated;
    });
    setIsDirty(true);
    // Clear error for the field being edited
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.legalName.trim()) newErrors.legalName = 'Legal Name is required';
    if (!formData.displayName.trim()) newErrors.displayName = 'Display Name is required';
    if (!formData.addressLine1.trim()) newErrors.addressLine1 = 'Address Line 1 is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!VALID_STATE_CODES.has(formData.stateCode)) newErrors.stateCode = 'Valid state code is required';
    
    if (!REGEX_PIN.test(formData.postalCode)) {
      newErrors.postalCode = 'Invalid Indian Postal Code';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!REGEX_INVOICE_PREFIX.test(formData.invoicePrefix)) {
      newErrors.invoicePrefix = 'Invoice Prefix can only contain letters, numbers, hyphens, and slashes';
    }

    if (formData.gstin) {
      if (!/^[A-Z0-9]{15}$/.test(formData.gstin)) {
        newErrors.gstin = 'GSTIN must be 15 alphanumeric characters';
      } else {
        const gstinStateCode = formData.gstin.substring(0, 2);
        const gstinPan = formData.gstin.substring(2, 12);
        
        if (gstinStateCode !== formData.stateCode) {
          newErrors.gstin = 'GSTIN first two characters must match the provided state code';
        }
        if (!REGEX_PAN.test(gstinPan)) {
          newErrors.gstin = 'GSTIN embedded PAN is invalid';
        }
        if (formData.pan && formData.pan !== gstinPan) {
          newErrors.gstin = 'GSTIN embedded PAN does not match the provided PAN';
        }
      }
    }

    if (formData.pan && !REGEX_PAN.test(formData.pan)) {
      newErrors.pan = 'Invalid PAN format';
    }

    if (formData.bankIfsc && !REGEX_IFSC.test(formData.bankIfsc)) {
      newErrors.bankIfsc = 'Invalid IFSC format';
    }

    if (formData.upiId && !REGEX_UPI.test(formData.upiId)) {
      newErrors.upiId = 'Invalid UPI ID format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }
    
    // Convert empty strings back to null/undefined before sending if needed by backend schema
    const payload: UpdateBusinessSettingsRequest = {
      ...formData,
      gstin: formData.gstin || null,
      pan: formData.pan || null,
      addressLine2: formData.addressLine2 || null,
      email: formData.email || null,
      phone: formData.phone || null,
      bankAccountName: formData.bankAccountName || null,
      bankAccountNumber: formData.bankAccountNumber || null,
      bankName: formData.bankName || null,
      bankIfsc: formData.bankIfsc || null,
      upiId: formData.upiId || null,
    };

    await onSubmit(payload);
    setIsDirty(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          <p>Please fix the validation errors in the form before saving.</p>
        </Alert>
      )}

      {/* Organization Details */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="legalName" className="text-sm font-medium">Legal Name *</label>
            <Input
              id="legalName"
              name="legalName"
              value={formData.legalName}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            {errors.legalName && <p className="text-xs text-destructive">{errors.legalName}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="displayName" className="text-sm font-medium">Display Name *</label>
            <Input
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            {errors.displayName && <p className="text-xs text-destructive">{errors.displayName}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email || ''}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium">Phone</label>
            <Input
              id="phone"
              name="phone"
              value={formData.phone || ''}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="addressLine1" className="text-sm font-medium">Address Line 1 *</label>
            <Input
              id="addressLine1"
              name="addressLine1"
              value={formData.addressLine1}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            {errors.addressLine1 && <p className="text-xs text-destructive">{errors.addressLine1}</p>}
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="addressLine2" className="text-sm font-medium">Address Line 2</label>
            <Input
              id="addressLine2"
              name="addressLine2"
              value={formData.addressLine2 || ''}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="city" className="text-sm font-medium">City *</label>
            <Input
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="stateCode" className="text-sm font-medium">State/UT *</label>
            <select
              id="stateCode"
              name="stateCode"
              value={formData.stateCode}
              onChange={handleChange}
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select State</option>
              {INDIA_STATES_AND_UT.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
            {errors.stateCode && <p className="text-xs text-destructive">{errors.stateCode}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="postalCode" className="text-sm font-medium">PIN Code *</label>
            <Input
              id="postalCode"
              name="postalCode"
              value={formData.postalCode}
              onChange={handleChange}
              disabled={isSubmitting}
              maxLength={6}
            />
            {errors.postalCode && <p className="text-xs text-destructive">{errors.postalCode}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="country" className="text-sm font-medium">Country *</label>
            <Input
              id="country"
              name="country"
              value="India"
              disabled
            />
          </div>
        </CardContent>
      </Card>

      {/* Tax & Compliance */}
      <Card>
        <CardHeader>
          <CardTitle>Tax & Compliance</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="gstin" className="text-sm font-medium">GSTIN</label>
            <Input
              id="gstin"
              name="gstin"
              value={formData.gstin || ''}
              onChange={handleChange}
              disabled={isSubmitting}
              maxLength={15}
              placeholder="e.g. 29ABCDE1234F1Z5"
              className="uppercase"
            />
            {errors.gstin && <p className="text-xs text-destructive">{errors.gstin}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="pan" className="text-sm font-medium">PAN</label>
            <Input
              id="pan"
              name="pan"
              value={formData.pan || ''}
              onChange={handleChange}
              disabled={isSubmitting}
              maxLength={10}
              placeholder="e.g. ABCDE1234F"
              className="uppercase"
            />
            {errors.pan && <p className="text-xs text-destructive">{errors.pan}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Banking & Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Banking & Payments</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="bankName" className="text-sm font-medium">Bank Name</label>
            <Input
              id="bankName"
              name="bankName"
              value={formData.bankName || ''}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="bankAccountName" className="text-sm font-medium">Account Name</label>
            <Input
              id="bankAccountName"
              name="bankAccountName"
              value={formData.bankAccountName || ''}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="bankAccountNumber" className="text-sm font-medium">Account Number</label>
            <Input
              id="bankAccountNumber"
              name="bankAccountNumber"
              value={formData.bankAccountNumber || ''}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="bankIfsc" className="text-sm font-medium">IFSC Code</label>
            <Input
              id="bankIfsc"
              name="bankIfsc"
              value={formData.bankIfsc || ''}
              onChange={handleChange}
              disabled={isSubmitting}
              maxLength={11}
              className="uppercase"
            />
            {errors.bankIfsc && <p className="text-xs text-destructive">{errors.bankIfsc}</p>}
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="upiId" className="text-sm font-medium">UPI ID</label>
            <Input
              id="upiId"
              name="upiId"
              value={formData.upiId || ''}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="e.g. business@bank"
            />
            {errors.upiId && <p className="text-xs text-destructive">{errors.upiId}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Invoicing Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Invoicing Defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="invoicePrefix" className="text-sm font-medium">Invoice Prefix *</label>
            <Input
              id="invoicePrefix"
              name="invoicePrefix"
              value={formData.invoicePrefix}
              onChange={handleChange}
              disabled={isSubmitting}
              maxLength={5}
              className="uppercase"
            />
            <p className="text-xs text-muted-foreground">Up to 5 characters (A-Z, 0-9, -, /)</p>
            {errors.invoicePrefix && <p className="text-xs text-destructive">{errors.invoicePrefix}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="defaultDueDays" className="text-sm font-medium">Default Due Days *</label>
            <Input
              id="defaultDueDays"
              name="defaultDueDays"
              type="number"
              min={0}
              max={365}
              value={formData.defaultDueDays}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">Days until invoice is due (0-365)</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <Button 
          type="submit" 
          disabled={!isDirty || isSubmitting} 
          isLoading={isSubmitting}
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
}
