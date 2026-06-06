// =============================================================================
// rfqConstants.js
// Central constants for RFQ module.
// Import these everywhere — no magic strings.
// =============================================================================

/** Valid RFQ status transitions map */
const VALID_TRANSITIONS = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['CLOSED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
};

/** RFQ status enum values */
const RFQ_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
};

/** Activity log actions for RFQ */
const RFQ_ACTIONS = {
  CREATED: 'RFQ_CREATED',
  UPDATED: 'RFQ_UPDATED',
  PUBLISHED: 'RFQ_PUBLISHED',
  CLOSED: 'RFQ_CLOSED',
  CANCELLED: 'RFQ_CANCELLED',
  DELETED: 'RFQ_DELETED',
  ITEMS_ADDED: 'RFQ_ITEMS_ADDED',
  VENDORS_ASSIGNED: 'RFQ_VENDORS_ASSIGNED',
};

module.exports = { VALID_TRANSITIONS, RFQ_STATUS, RFQ_ACTIONS };