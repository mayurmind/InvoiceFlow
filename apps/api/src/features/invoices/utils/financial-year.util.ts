export function getFinancialYear(invoiceDate: Date): string {
  const year = invoiceDate.getUTCFullYear();
  const month = invoiceDate.getUTCMonth(); // 0-indexed, so 3 is April

  let startYear = year;
  if (month < 3) {
    startYear = year - 1;
  }

  const endYear = startYear + 1;
  const startStr = startYear.toString().slice(-2);
  const endStr = endYear.toString().slice(-2);

  return `${startStr}-${endStr}`;
}
