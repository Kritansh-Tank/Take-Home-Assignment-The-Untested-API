/**
 * taskService.js
 *
 * Business logic and in-memory data store for the Task Manager API.
 * All task data lives in the `tasks` array and is reset when the process
 * restarts. The `_reset` helper exists solely for test isolation.
 */

const { v4: uuidv4 } = require('uuid');

// In-memory store — holds all tasks for the lifetime of the process.
let tasks = [];

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Returns a shallow copy of every task in the store.
 * A copy is returned so callers cannot accidentally mutate the store.
 */
const getAll = () => [...tasks];

/**
 * Finds a single task by its UUID.
 * Returns the task object, or `undefined` if no match is found.
 */
const findById = (id) => tasks.find((t) => t.id === id);

/**
 * Returns all tasks whose status exactly matches the given value.
 *
 * BUG FIX: The original code used `t.status.includes(status)` (substring
 * match), which would incorrectly match partial strings — e.g. searching for
 * "in" would match "in_progress". Changed to strict equality (`===`).
 */
const getByStatus = (status) => tasks.filter((t) => t.status === status);

/**
 * Returns a page of tasks using 1-based pagination.
 *
 * BUG FIX: The original offset calculation was `page * limit`, which is
 * 0-based — page 1 would skip the first `limit` items entirely. Changed to
 * `(page - 1) * limit` so page 1 correctly starts at index 0.
 *
 * @param {number} page  - 1-based page number
 * @param {number} limit - Number of items per page
 */
const getPaginated = (page, limit) => {
  const offset = (page - 1) * limit; // 1-indexed: page 1 → offset 0
  return tasks.slice(offset, offset + limit);
};

/**
 * Returns task counts grouped by status plus an overdue count.
 * A task is considered overdue when it has a dueDate in the past AND its
 * status is not 'done'.
 */
const getStats = () => {
  const now = new Date();

  // Initialise counters for each known status.
  const counts = { todo: 0, in_progress: 0, done: 0 };
  let overdue = 0;

  tasks.forEach((t) => {
    // Increment the matching status bucket (unknown statuses are ignored).
    if (counts[t.status] !== undefined) counts[t.status]++;

    // Count overdue tasks: must have a dueDate, not be done, and past due.
    if (t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now) {
      overdue++;
    }
  });

  return { ...counts, overdue };
};

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

/**
 * Creates a new task and adds it to the store.
 * Sensible defaults are applied for optional fields.
 *
 * @param {object} fields - At minimum `{ title }`.
 * @returns The newly created task object.
 */
const create = ({
  title,
  description = '',
  status = 'todo',
  priority = 'medium',
  dueDate = null,
}) => {
  const task = {
    id: uuidv4(),
    title,
    description,
    status,
    priority,
    dueDate,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
};

/**
 * Performs a partial update on an existing task (merge semantics).
 * Returns the updated task, or `null` if no task with that id exists.
 *
 * @param {string} id     - UUID of the task to update.
 * @param {object} fields - Fields to merge into the existing task.
 */
const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated = { ...tasks[index], ...fields };
  tasks[index] = updated;
  return updated;
};

/**
 * Removes a task from the store by id.
 * Returns `true` on success, `false` if the task was not found.
 */
const remove = (id) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;

  tasks.splice(index, 1);
  return true;
};

/**
 * Marks a task as complete by setting its status to 'done' and recording
 * the completion timestamp.
 *
 * BUG FIX: The original code also reset `priority` to 'medium' on every
 * completion, silently discarding the task's actual priority. That line has
 * been removed so priority is preserved.
 *
 * Returns the updated task, or `null` if no task with that id exists.
 */
const completeTask = (id) => {
  const task = findById(id);
  if (!task) return null;

  const updated = {
    ...task,
    // priority is intentionally NOT reset — preserve its original value.
    status: 'done',
    completedAt: new Date().toISOString(),
  };

  const index = tasks.findIndex((t) => t.id === id);
  tasks[index] = updated;
  return updated;
};

/**
 * Assigns a task to a named person.
 *
 * Design decisions:
 *  - An empty string is rejected by the validator before this function is
 *    called, so we can trust `assignee` is a non-empty string here.
 *  - Re-assigning an already-assigned task is allowed; the caller (route
 *    handler) may choose to surface a warning, but the service simply
 *    overwrites the previous assignee.
 *  - The `assignee` field is stored directly on the task object, making it
 *    visible in `getAll`, `findById`, etc. without any extra work.
 *
 * Returns the updated task, or `null` if no task with that id exists.
 *
 * @param {string} id       - UUID of the task to assign.
 * @param {string} assignee - Name of the person to assign the task to.
 */
const assignTask = (id, assignee) => {
  const task = findById(id);
  if (!task) return null;

  const index = tasks.findIndex((t) => t.id === id);
  const updated = { ...task, assignee };
  tasks[index] = updated;
  return updated;
};

// ---------------------------------------------------------------------------
// Test utility
// ---------------------------------------------------------------------------

/**
 * Resets the in-memory store to an empty array.
 * Only used in tests to ensure test isolation.
 */
const _reset = () => {
  tasks = [];
};

module.exports = {
  getAll,
  findById,
  getByStatus,
  getPaginated,
  getStats,
  create,
  update,
  remove,
  completeTask,
  assignTask, // new feature
  _reset,
};
