/**
 * Formats a decimal string or number to INR currency string.
 * Example: "12500.50" -> "₹12,500.50"
 */
export function formatCurrency(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '₹0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0.00';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats an ISO / YYYY-MM-DD date to a human readable format (e.g. "12 Mar 2026").
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Formats tax rate to percentage string. Example: "18.00" -> "18%"
 */
export function formatPercentage(rate: string | number | null | undefined): string {
  if (rate === null || rate === undefined || rate === '') return '0%';
  const num = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (isNaN(num)) return '0%';
  return `${num}%`;
}
