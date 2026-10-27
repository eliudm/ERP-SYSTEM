export type Period =
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'this_year';

export interface PeriodRange {
  startDate: string;
  endDate: string;
  granularity: 'day' | 'month';
}

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

// Shared across the Business Reports and Branch Comparison screens so the
// period labels ("This Month", "3 Months"...) always mean the same date
// range and chart granularity in both places.
export const getPeriodRange = (period: Period): PeriodRange => {
  const now = new Date();
  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: toDateInput(start),
      endDate: toDateInput(now),
      granularity: 'day',
    };
  }
  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      startDate: toDateInput(start),
      endDate: toDateInput(end),
      granularity: 'day',
    };
  }
  if (period === 'last_3_months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return {
      startDate: toDateInput(start),
      endDate: toDateInput(now),
      granularity: 'month',
    };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  return {
    startDate: toDateInput(start),
    endDate: toDateInput(now),
    granularity: 'month',
  };
};

export const PERIOD_BUTTONS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: '3 Months' },
  { value: 'this_year', label: 'This Year' },
] as const;
