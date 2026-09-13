import * as React from 'react';
import { INDIA_STATES_AND_UT } from '../../business-settings/constants/business-settings.constants';
import { Button } from '../../../components/ui/button';
import { clientFormSchema } from '../types/client.types';
import type { ClientFormValues, ClientResponse } from '../types/client.types';


interface ClientFormProps {
  initialData?: ClientResponse | null;
  onSubmit: (data: ClientFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}

export function ClientForm({ initialData, onSubmit, onCancel, isSubmitting, submitLabel }: ClientFormProps) {
  const [formData, setFormData] = React.useState<ClientFormValues>({
    name: initialData?.name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    gstin: initialData?.gstin || '',
    pan: initialData?.pan || '',
    addressLine1: initialData?.addressLine1 || '',
    addressLine2: initialData?.addressLine2 || '',
    city: initialData?.city || '',
    stateCode: initialData?.stateCode || '',
    postalCode: initialData?.postalCode || '',
    notes: initialData?.notes || '',
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      const validData = clientFormSchema.parse(formData);
      await onSubmit(validData);
    } catch (err) {
      if (err && typeof err === 'object' && 'issues' in err) {
        const zodErr = err as { issues: { path: (string | number)[], message: string }[] };
        const newErrors: Record<string, string> = {};
        for (const issue of zodErr.issues) {
          const key = issue.path[0] as string;
          if (key && !newErrors[key]) {
            newErrors[key] = issue.message;
          }
        }
        setErrors(newErrors);
      }
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-8 bg-white p-6 rounded-lg border shadow-sm">
      
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Basic Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Client Name <span className="text-red-500">*</span></label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
              placeholder="E.g. Acme Corporation"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
              placeholder="contact@example.com"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
              placeholder="+91 9876543210"
            />
            {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
          </div>
        </div>
      </div>

      {/* Tax Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Tax Information</h3>
        <p className="text-sm text-gray-500 mb-2">GSTIN state code must match the selected State/UT below.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="gstin" className="block text-sm font-medium text-gray-700">GSTIN</label>
            <input
              id="gstin"
              name="gstin"
              type="text"
              value={formData.gstin || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 uppercase"
              placeholder="27AAAAA0000A1Z5"
            />
            {errors.gstin && <p className="mt-1 text-sm text-red-600">{errors.gstin}</p>}
          </div>

          <div>
            <label htmlFor="pan" className="block text-sm font-medium text-gray-700">PAN</label>
            <input
              id="pan"
              name="pan"
              type="text"
              value={formData.pan || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 uppercase"
              placeholder="ABCDE1234F"
            />
            {errors.pan && <p className="mt-1 text-sm text-red-600">{errors.pan}</p>}
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Address</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="addressLine1" className="block text-sm font-medium text-gray-700">Address Line 1 <span className="text-red-500">*</span></label>
            <input
              id="addressLine1"
              name="addressLine1"
              type="text"
              value={formData.addressLine1}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            />
            {errors.addressLine1 && <p className="mt-1 text-sm text-red-600">{errors.addressLine1}</p>}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="addressLine2" className="block text-sm font-medium text-gray-700">Address Line 2</label>
            <input
              id="addressLine2"
              name="addressLine2"
              type="text"
              value={formData.addressLine2 || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            />
            {errors.addressLine2 && <p className="mt-1 text-sm text-red-600">{errors.addressLine2}</p>}
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700">City <span className="text-red-500">*</span></label>
            <input
              id="city"
              name="city"
              type="text"
              value={formData.city}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            />
            {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
          </div>

          <div>
            <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700">PIN Code <span className="text-red-500">*</span></label>
            <input
              id="postalCode"
              name="postalCode"
              type="text"
              value={formData.postalCode}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            />
            {errors.postalCode && <p className="mt-1 text-sm text-red-600">{errors.postalCode}</p>}
          </div>

          <div>
            <label htmlFor="stateCode" className="block text-sm font-medium text-gray-700">State/UT <span className="text-red-500">*</span></label>
            <select
              id="stateCode"
              name="stateCode"
              value={formData.stateCode}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white"
            >
              <option value="">Select State</option>
              {INDIA_STATES_AND_UT.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
            {errors.stateCode && <p className="mt-1 text-sm text-red-600">{errors.stateCode}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Country</label>
            <input
              type="text"
              value="India"
              disabled
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 text-gray-500 sm:text-sm border p-2"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes (Internal)</label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes || ''}
          onChange={handleChange}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
        />
        {errors.notes && <p className="mt-1 text-sm text-red-600">{errors.notes}</p>}
      </div>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
