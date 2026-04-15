/**
 * validators.js
 *
 * Input validation helpers for the Task API.
 * Each function returns a human-readable error string on failure, or `null`
 * when the input is valid. This convention lets route handlers do a single
 * null-check and forward the message directly to the client.
 */

// Permitted values — kept in constants so validators and tests share the same
// source of truth.
const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

/**
 * Validates the request body for POST /tasks (task creation).
 *
 * Rules:
 *  - `title` is required and must be a non-empty string.
 *  - `status`, `priority`, and `dueDate` are optional but must be valid when
 *    provided.
 *
 * @param {object} body - The parsed JSON request body.
 * @returns {string|null} Error message, or null if valid.
 */
const validateCreateTask = (body) => {
  // title is the only required field.
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return 'title is required and must be a non-empty string';
  }

  // If status is provided it must be one of the known values.
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }

  // If priority is provided it must be one of the known values.
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }

  // If dueDate is provided it must be parseable as a date.
  if (body.dueDate && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }

  return null; // all checks passed
};

/**
 * Validates the request body for PUT /tasks/:id (full task update).
 *
 * Rules:
 *  - `title`, `status`, `priority`, and `dueDate` are all optional, but when
 *    present they must satisfy the same constraints as on creation.
 *  - An empty update body (no fields) passes validation — the route handler
 *    decides what to do with a no-op update.
 *
 * @param {object} body - The parsed JSON request body.
 * @returns {string|null} Error message, or null if valid.
 */
const validateUpdateTask = (body) => {
  // title is optional on update, but must be non-empty when provided.
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim() === '')) {
    return 'title must be a non-empty string';
  }

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }

  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }

  if (body.dueDate && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }

  return null; // all checks passed
};

/**
 * Validates the request body for PATCH /tasks/:id/assign.
 *
 * Rules:
 *  - `assignee` is required and must be a non-empty string.
 *  - We intentionally do NOT restrict what names are valid — the API should
 *    remain flexible enough to accept full names, usernames, email-style
 *    identifiers, etc.
 *
 * @param {object} body - The parsed JSON request body.
 * @returns {string|null} Error message, or null if valid.
 */
const validateAssignTask = (body) => {
  // assignee must be present and non-empty.
  if (!body.assignee || typeof body.assignee !== 'string' || body.assignee.trim() === '') {
    return 'assignee is required and must be a non-empty string';
  }

  return null; // all checks passed
};

module.exports = { validateCreateTask, validateUpdateTask, validateAssignTask };
