/**
 * routes/tasks.js
 *
 * Express router for all /tasks endpoints.
 * Route handlers are intentionally thin: they delegate validation to
 * `validators.js` and all business logic to `taskService.js`.
 */

const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const {
  validateCreateTask,
  validateUpdateTask,
  validateAssignTask,
} = require('../utils/validators');

// ---------------------------------------------------------------------------
// GET /tasks/stats
// Must be registered BEFORE GET /:id routes to avoid Express treating "stats"
// as a task id.
// ---------------------------------------------------------------------------

/**
 * Returns task counts grouped by status and a count of overdue tasks.
 * Response shape: { todo, in_progress, done, overdue }
 */
router.get('/stats', (req, res) => {
  const stats = taskService.getStats();
  res.json(stats);
});

// ---------------------------------------------------------------------------
// GET /tasks
// Supports optional query params: ?status=, ?page=, ?limit=
// ---------------------------------------------------------------------------

/**
 * Lists tasks.
 *  - ?status=<value>          → filter by status (exact match)
 *  - ?page=<n>&?limit=<n>    → paginated result (1-based page index)
 *  - (no params)              → returns all tasks
 *
 * Note: status filter and pagination are mutually exclusive; status takes
 * priority if both are supplied.
 */
router.get('/', (req, res) => {
  const { status, page, limit } = req.query;

  if (status) {
    // Return tasks matching the given status exactly.
    const tasks = taskService.getByStatus(status);
    return res.json(tasks);
  }

  if (page !== undefined || limit !== undefined) {
    // Parse with safe defaults: page 1, 10 items per page.
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const tasks = taskService.getPaginated(pageNum, limitNum);
    return res.json(tasks);
  }

  // No filters — return everything.
  const tasks = taskService.getAll();
  res.json(tasks);
});

// ---------------------------------------------------------------------------
// POST /tasks — create a new task
// ---------------------------------------------------------------------------

/**
 * Creates a task.
 * Required body field: `title` (string).
 * Optional: `description`, `status`, `priority`, `dueDate`.
 * Returns the created task with HTTP 201.
 */
router.post('/', (req, res) => {
  const error = validateCreateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.create(req.body);
  res.status(201).json(task);
});

// ---------------------------------------------------------------------------
// PUT /tasks/:id — full update of an existing task
// ---------------------------------------------------------------------------

/**
 * Updates any fields on an existing task (merge semantics — omitted fields
 * keep their current values).
 * Returns the updated task, or 404 if the task does not exist.
 */
router.put('/:id', (req, res) => {
  const error = validateUpdateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.update(req.params.id, req.body);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

// ---------------------------------------------------------------------------
// DELETE /tasks/:id — remove a task
// ---------------------------------------------------------------------------

/**
 * Deletes a task by id.
 * Returns 204 No Content on success, 404 if the task does not exist.
 */
router.delete('/:id', (req, res) => {
  const deleted = taskService.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// PATCH /tasks/:id/complete — mark a task done
// ---------------------------------------------------------------------------

/**
 * Sets the task's status to 'done' and records `completedAt`.
 * The task's priority is preserved (bug fix in service layer).
 * Returns the updated task, or 404 if not found.
 */
router.patch('/:id/complete', (req, res) => {
  const task = taskService.completeTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

// ---------------------------------------------------------------------------
// PATCH /tasks/:id/assign — assign a task to a person
// ---------------------------------------------------------------------------

/**
 * Assigns a task to the named person supplied in the request body.
 *
 * Body: { "assignee": "string" }
 *
 * Validation rules (enforced by validateAssignTask):
 *  - `assignee` must be a non-empty string.
 *
 * Edge cases:
 *  - 404 is returned if the task id does not exist.
 *  - Re-assigning an already-assigned task is allowed; the new assignee
 *    overwrites the previous one. This keeps the API simple and mirrors
 *    typical task-tracker behaviour where reassignment is common.
 *  - We do NOT whitelist assignee values — the API should not need to know
 *    about the organisation's user list.
 *
 * Returns the updated task with HTTP 200.
 */
router.patch('/:id/assign', (req, res) => {
  // Validate the body before touching the store.
  const error = validateAssignTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.assignTask(req.params.id, req.body.assignee.trim());
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

module.exports = router;
