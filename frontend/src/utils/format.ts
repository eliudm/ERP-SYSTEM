export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    DRAFT: 'default',
    APPROVED: 'blue',
    PAID: 'green',
    VOID: 'red',
    POSTED: 'green',
    PENDING: 'orange',
    FAILED: 'red',
    SUCCESS: 'green',
    ACTIVE: 'green',
    INACTIVE: 'orange',
    TERMINATED: 'red',
  };
  return colors[status] || 'default';
};
