export const ROLES = {
  ADMIN: 'ADMIN',
  PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER',
  VENDOR: 'VENDOR',
  MANAGER: 'MANAGER',
};

export const RFQ_STATUS_COLORS = {
  DRAFT: 'gray', PUBLISHED: 'blue', CLOSED: 'green', CANCELLED: 'red',
};

export const QUOTATION_STATUS_COLORS = {
  PENDING: 'gray', SUBMITTED: 'blue', ACCEPTED: 'green', REJECTED: 'red', REVISED: 'yellow',
};

export const PO_STATUS_COLORS = {
  DRAFT: 'gray', ISSUED: 'blue', ACKNOWLEDGED: 'yellow', COMPLETED: 'green', CANCELLED: 'red',
};

export const INVOICE_STATUS_COLORS = {
  DRAFT: 'gray', SENT: 'blue', PAID: 'green', OVERDUE: 'red', CANCELLED: 'gray',
};