/**
 * tests/taskService.test.js
 *
 * Unit tests for taskService.js — tests the service functions directly
 * without going through the HTTP layer.
 *
 * Each describe block calls `_reset()` before every test to guarantee a clean,
 * isolated in-memory store.
 */

const taskService = require('../src/services/taskService');

// Reset the in-memory store before each test.
beforeEach(() => {
    taskService._reset();
});

// ---------------------------------------------------------------------------
// getAll
// ---------------------------------------------------------------------------

describe('getAll', () => {
    it('returns an empty array when there are no tasks', () => {
        expect(taskService.getAll()).toEqual([]);
    });

    it('returns all created tasks', () => {
        taskService.create({ title: 'Task A' });
        taskService.create({ title: 'Task B' });
        expect(taskService.getAll()).toHaveLength(2);
    });

    it('returns a copy — mutating the result does not affect the store', () => {
        taskService.create({ title: 'Task A' });
        const all = taskService.getAll();
        all.pop(); // mutate the returned array
        expect(taskService.getAll()).toHaveLength(1); // store unchanged
    });
});

// ---------------------------------------------------------------------------
// findById
// ---------------------------------------------------------------------------

describe('findById', () => {
    it('returns the task when it exists', () => {
        const created = taskService.create({ title: 'Find me' });
        const found = taskService.findById(created.id);
        expect(found).toBeDefined();
        expect(found.title).toBe('Find me');
    });

    it('returns undefined for an unknown id', () => {
        expect(taskService.findById('nonexistent-id')).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// getByStatus
// ---------------------------------------------------------------------------

describe('getByStatus', () => {
    it('returns only tasks with the exact matching status', () => {
        taskService.create({ title: 'Todo task', status: 'todo' });
        taskService.create({ title: 'In progress task', status: 'in_progress' });
        taskService.create({ title: 'Done task', status: 'done' });

        const todos = taskService.getByStatus('todo');
        expect(todos).toHaveLength(1);
        expect(todos[0].title).toBe('Todo task');
    });

    it('does NOT use substring matching — "in" should not match "in_progress"', () => {
        // This verifies the bug fix: the original code used .includes() which
        // would match "in_progress" when the user searched for "in".
        taskService.create({ title: 'In progress task', status: 'in_progress' });
        expect(taskService.getByStatus('in')).toHaveLength(0);
    });

    it('returns an empty array when no tasks match', () => {
        taskService.create({ title: 'A task', status: 'todo' });
        expect(taskService.getByStatus('done')).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// getPaginated
// ---------------------------------------------------------------------------

describe('getPaginated', () => {
    beforeEach(() => {
        // Create 15 tasks labelled 1–15.
        for (let i = 1; i <= 15; i++) {
            taskService.create({ title: `Task ${i}` });
        }
    });

    it('page 1 returns the first N items (1-based index)', () => {
        // This verifies the bug fix: the original offset was page*limit (0-indexed)
        // so page 1 returned items 10–19 instead of 0–9.
        const page1 = taskService.getPaginated(1, 10);
        expect(page1).toHaveLength(10);
        expect(page1[0].title).toBe('Task 1');
        expect(page1[9].title).toBe('Task 10');
    });

    it('page 2 returns the next batch of items', () => {
        const page2 = taskService.getPaginated(2, 10);
        expect(page2).toHaveLength(5); // only 15 tasks total
        expect(page2[0].title).toBe('Task 11');
    });

    it('returns fewer items than limit on the last page', () => {
        const page2 = taskService.getPaginated(2, 10);
        expect(page2).toHaveLength(5);
    });

    it('returns empty array when page exceeds available data', () => {
        expect(taskService.getPaginated(10, 10)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

describe('getStats', () => {
    it('returns zero counts when there are no tasks', () => {
        expect(taskService.getStats()).toEqual({
            todo: 0,
            in_progress: 0,
            done: 0,
            overdue: 0,
        });
    });

    it('counts tasks by status correctly', () => {
        taskService.create({ title: 'A', status: 'todo' });
        taskService.create({ title: 'B', status: 'todo' });
        taskService.create({ title: 'C', status: 'in_progress' });
        taskService.create({ title: 'D', status: 'done' });

        const stats = taskService.getStats();
        expect(stats.todo).toBe(2);
        expect(stats.in_progress).toBe(1);
        expect(stats.done).toBe(1);
    });

    it('counts overdue tasks — past dueDate and not done', () => {
        // A task that is past due.
        taskService.create({ title: 'Overdue', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
        // A completed task with a past due date — should NOT be overdue.
        taskService.create({ title: 'Done overdue', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });
        // A future due date — not overdue.
        taskService.create({ title: 'Future', status: 'todo', dueDate: '2099-01-01T00:00:00.000Z' });

        const stats = taskService.getStats();
        expect(stats.overdue).toBe(1);
    });

    it('does not count tasks without a dueDate as overdue', () => {
        taskService.create({ title: 'No due date', status: 'todo' });
        expect(taskService.getStats().overdue).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('create', () => {
    it('creates a task with the given title', () => {
        const task = taskService.create({ title: 'My task' });
        expect(task.title).toBe('My task');
    });

    it('assigns a unique uuid id', () => {
        const a = taskService.create({ title: 'A' });
        const b = taskService.create({ title: 'B' });
        expect(a.id).toBeDefined();
        expect(b.id).toBeDefined();
        expect(a.id).not.toBe(b.id);
    });

    it('applies default values for optional fields', () => {
        const task = taskService.create({ title: 'Defaults' });
        expect(task.status).toBe('todo');
        expect(task.priority).toBe('medium');
        expect(task.description).toBe('');
        expect(task.dueDate).toBeNull();
        expect(task.completedAt).toBeNull();
        expect(task.createdAt).toBeDefined();
    });

    it('respects explicit field values when provided', () => {
        const task = taskService.create({
            title: 'Custom',
            status: 'in_progress',
            priority: 'high',
            description: 'desc',
            dueDate: '2099-01-01T00:00:00.000Z',
        });
        expect(task.status).toBe('in_progress');
        expect(task.priority).toBe('high');
        expect(task.description).toBe('desc');
    });

    it('adds the task so getAll returns it', () => {
        taskService.create({ title: 'Stored' });
        expect(taskService.getAll()).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe('update', () => {
    it('merges the given fields into the task', () => {
        const task = taskService.create({ title: 'Original', priority: 'low' });
        const updated = taskService.update(task.id, { title: 'Updated', priority: 'high' });
        expect(updated.title).toBe('Updated');
        expect(updated.priority).toBe('high');
    });

    it('preserves unspecified fields', () => {
        const task = taskService.create({ title: 'Original', description: 'keep this' });
        const updated = taskService.update(task.id, { title: 'New title' });
        expect(updated.description).toBe('keep this');
    });

    it('returns null when the task does not exist', () => {
        expect(taskService.update('bad-id', { title: 'x' })).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe('remove', () => {
    it('removes an existing task and returns true', () => {
        const task = taskService.create({ title: 'To delete' });
        expect(taskService.remove(task.id)).toBe(true);
        expect(taskService.getAll()).toHaveLength(0);
    });

    it('returns false when the task does not exist', () => {
        expect(taskService.remove('nonexistent')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// completeTask
// ---------------------------------------------------------------------------

describe('completeTask', () => {
    it('sets status to done and records completedAt', () => {
        const task = taskService.create({ title: 'Finish me' });
        const updated = taskService.completeTask(task.id);
        expect(updated.status).toBe('done');
        expect(updated.completedAt).not.toBeNull();
    });

    it('preserves the original priority — does NOT reset to medium (bug fix)', () => {
        // The original completeTask set priority: 'medium' unconditionally.
        // After the fix, a high-priority task should remain high after completion.
        const task = taskService.create({ title: 'High priority', priority: 'high' });
        const completed = taskService.completeTask(task.id);
        expect(completed.priority).toBe('high');
    });

    it('preserves low priority after completion', () => {
        const task = taskService.create({ title: 'Low priority', priority: 'low' });
        const completed = taskService.completeTask(task.id);
        expect(completed.priority).toBe('low');
    });

    it('returns null when the task does not exist', () => {
        expect(taskService.completeTask('nonexistent')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// assignTask
// ---------------------------------------------------------------------------

describe('assignTask', () => {
    it('stores the assignee on the task and returns the updated task', () => {
        const task = taskService.create({ title: 'Assign me' });
        const updated = taskService.assignTask(task.id, 'Alice');
        expect(updated.assignee).toBe('Alice');
    });

    it('overwrites a previous assignee (re-assignment is allowed)', () => {
        const task = taskService.create({ title: 'Reassign me' });
        taskService.assignTask(task.id, 'Alice');
        const updated = taskService.assignTask(task.id, 'Bob');
        expect(updated.assignee).toBe('Bob');
    });

    it('persists the assignee so findById reflects the change', () => {
        const task = taskService.create({ title: 'Persist assignee' });
        taskService.assignTask(task.id, 'Carol');
        expect(taskService.findById(task.id).assignee).toBe('Carol');
    });

    it('returns null when the task does not exist', () => {
        expect(taskService.assignTask('bad-id', 'Dave')).toBeNull();
    });
});
