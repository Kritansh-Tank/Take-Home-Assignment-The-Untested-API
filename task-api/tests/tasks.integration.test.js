/**
 * tests/tasks.integration.test.js
 *
 * Integration tests for all /tasks API routes using Supertest.
 * Tests run against the Express app directly — no network port is bound.
 *
 * The in-memory store is reset before each test via taskService._reset() to
 * ensure each test starts from a known empty state.
 */

const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

// Reset the store before every test for full isolation.
beforeEach(() => {
    taskService._reset();
});

// ---------------------------------------------------------------------------
// Helper — quickly creates a task through the API and returns the parsed body.
// ---------------------------------------------------------------------------
const createTask = (fields = {}) =>
    request(app)
        .post('/tasks')
        .send({ title: 'Test task', ...fields })
        .then((res) => res.body);

// ===========================================================================
// GET /tasks
// ===========================================================================

describe('GET /tasks', () => {
    it('returns an empty array when there are no tasks', async () => {
        const res = await request(app).get('/tasks');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns all tasks', async () => {
        await createTask({ title: 'Task 1' });
        await createTask({ title: 'Task 2' });

        const res = await request(app).get('/tasks');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
    });

    // ── ?status filter ────────────────────────────────────────────────────────

    it('?status= filters by status exactly', async () => {
        await createTask({ title: 'Todo', status: 'todo' });
        await createTask({ title: 'In progress', status: 'in_progress' });

        const res = await request(app).get('/tasks?status=todo');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Todo');
    });

    it('?status= returns empty array for a status with no matching tasks', async () => {
        await createTask({ title: 'Todo', status: 'todo' });

        const res = await request(app).get('/tasks?status=done');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    // ── pagination ─────────────────────────────────────────────────────────────

    it('?page=1&limit=2 returns the first two tasks', async () => {
        await createTask({ title: 'Task 1' });
        await createTask({ title: 'Task 2' });
        await createTask({ title: 'Task 3' });

        const res = await request(app).get('/tasks?page=1&limit=2');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        // Page 1 should include Task 1 (verifies the pagination bug is fixed).
        expect(res.body[0].title).toBe('Task 1');
    });

    it('?page=2&limit=2 returns the second batch of tasks', async () => {
        await createTask({ title: 'Task 1' });
        await createTask({ title: 'Task 2' });
        await createTask({ title: 'Task 3' });

        const res = await request(app).get('/tasks?page=2&limit=2');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Task 3');
    });

    it('pagination with only ?page= uses a default limit', async () => {
        await createTask({ title: 'Task 1' });

        const res = await request(app).get('/tasks?page=1');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });
});

// ===========================================================================
// POST /tasks
// ===========================================================================

describe('POST /tasks', () => {
    it('creates a task and returns 201 with the new task', async () => {
        const res = await request(app)
            .post('/tasks')
            .send({ title: 'Brand new task' });

        expect(res.status).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.title).toBe('Brand new task');
        expect(res.body.status).toBe('todo'); // default
        expect(res.body.priority).toBe('medium'); // default
    });

    it('creates a task with all optional fields provided', async () => {
        const res = await request(app).post('/tasks').send({
            title: 'Full task',
            description: 'A description',
            status: 'in_progress',
            priority: 'high',
            dueDate: '2099-12-31T00:00:00.000Z',
        });

        expect(res.status).toBe(201);
        expect(res.body.description).toBe('A description');
        expect(res.body.status).toBe('in_progress');
        expect(res.body.priority).toBe('high');
        expect(res.body.dueDate).toBe('2099-12-31T00:00:00.000Z');
    });

    // ── edge cases ─────────────────────────────────────────────────────────────

    it('returns 400 when title is missing', async () => {
        const res = await request(app).post('/tasks').send({ priority: 'low' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/title/i);
    });

    it('returns 400 when title is an empty string', async () => {
        const res = await request(app).post('/tasks').send({ title: '   ' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/title/i);
    });

    it('returns 400 when status is invalid', async () => {
        const res = await request(app)
            .post('/tasks')
            .send({ title: 'Bad status', status: 'invalid' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/status/i);
    });

    it('returns 400 when priority is invalid', async () => {
        const res = await request(app)
            .post('/tasks')
            .send({ title: 'Bad priority', priority: 'critical' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/priority/i);
    });

    it('returns 400 when dueDate is not a valid date', async () => {
        const res = await request(app)
            .post('/tasks')
            .send({ title: 'Bad date', dueDate: 'not-a-date' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/dueDate/i);
    });
});

// ===========================================================================
// GET /tasks/stats
// ===========================================================================

describe('GET /tasks/stats', () => {
    it('returns zero counts when there are no tasks', async () => {
        const res = await request(app).get('/tasks/stats');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
    });

    it('returns correct status counts', async () => {
        await createTask({ status: 'todo' });
        await createTask({ status: 'todo' });
        await createTask({ status: 'in_progress' });
        await createTask({ status: 'done' });

        const res = await request(app).get('/tasks/stats');
        expect(res.status).toBe(200);
        expect(res.body.todo).toBe(2);
        expect(res.body.in_progress).toBe(1);
        expect(res.body.done).toBe(1);
    });

    it('counts overdue tasks correctly', async () => {
        // Past due date + not done → overdue.
        await createTask({ status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
        // Past due date + done → NOT overdue.
        await createTask({ status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });

        const res = await request(app).get('/tasks/stats');
        expect(res.body.overdue).toBe(1);
    });
});

// ===========================================================================
// PUT /tasks/:id
// ===========================================================================

describe('PUT /tasks/:id', () => {
    it('updates a task and returns the updated object', async () => {
        const task = await createTask({ title: 'Original', priority: 'low' });

        const res = await request(app)
            .put(`/tasks/${task.id}`)
            .send({ title: 'Updated', priority: 'high' });

        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Updated');
        expect(res.body.priority).toBe('high');
    });

    it('preserves unspecified fields on update', async () => {
        const task = await createTask({ title: 'Keep description', description: 'original desc' });

        const res = await request(app)
            .put(`/tasks/${task.id}`)
            .send({ title: 'New title' });

        expect(res.status).toBe(200);
        expect(res.body.description).toBe('original desc');
    });

    it('returns 404 for a non-existent task id', async () => {
        const res = await request(app)
            .put('/tasks/nonexistent-id')
            .send({ title: 'Update' });

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 400 when title is explicitly set to empty string', async () => {
        const task = await createTask();

        const res = await request(app)
            .put(`/tasks/${task.id}`)
            .send({ title: '' });

        expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid status value', async () => {
        const task = await createTask();

        const res = await request(app)
            .put(`/tasks/${task.id}`)
            .send({ status: 'invalid' });

        expect(res.status).toBe(400);
    });
});

// ===========================================================================
// DELETE /tasks/:id
// ===========================================================================

describe('DELETE /tasks/:id', () => {
    it('deletes an existing task and returns 204', async () => {
        const task = await createTask();

        const res = await request(app).delete(`/tasks/${task.id}`);
        expect(res.status).toBe(204);

        // Verify it's gone.
        const allRes = await request(app).get('/tasks');
        expect(allRes.body).toHaveLength(0);
    });

    it('returns 404 when the task does not exist', async () => {
        const res = await request(app).delete('/tasks/nonexistent-id');
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/not found/i);
    });
});

// ===========================================================================
// PATCH /tasks/:id/complete
// ===========================================================================

describe('PATCH /tasks/:id/complete', () => {
    it('marks a task as done and sets completedAt', async () => {
        const task = await createTask();

        const res = await request(app).patch(`/tasks/${task.id}/complete`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('done');
        expect(res.body.completedAt).not.toBeNull();
    });

    it('preserves priority after completion (bug fix verification)', async () => {
        // Original code reset priority to 'medium' — this test confirms the fix.
        const task = await createTask({ title: 'High prio', priority: 'high' });

        const res = await request(app).patch(`/tasks/${task.id}/complete`);
        expect(res.status).toBe(200);
        expect(res.body.priority).toBe('high');
    });

    it('returns 404 for a non-existent task', async () => {
        const res = await request(app).patch('/tasks/nonexistent-id/complete');
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/not found/i);
    });
});

// ===========================================================================
// PATCH /tasks/:id/assign
// ===========================================================================

describe('PATCH /tasks/:id/assign', () => {
    it('assigns a task to the given assignee and returns 200 with the task', async () => {
        const task = await createTask();

        const res = await request(app)
            .patch(`/tasks/${task.id}/assign`)
            .send({ assignee: 'Alice' });

        expect(res.status).toBe(200);
        expect(res.body.assignee).toBe('Alice');
        expect(res.body.id).toBe(task.id);
    });

    it('trims leading/trailing whitespace from the assignee name', async () => {
        const task = await createTask();

        const res = await request(app)
            .patch(`/tasks/${task.id}/assign`)
            .send({ assignee: '  Bob  ' });

        expect(res.status).toBe(200);
        expect(res.body.assignee).toBe('Bob');
    });

    it('allows reassigning an already-assigned task', async () => {
        const task = await createTask();
        await request(app)
            .patch(`/tasks/${task.id}/assign`)
            .send({ assignee: 'Alice' });

        const res = await request(app)
            .patch(`/tasks/${task.id}/assign`)
            .send({ assignee: 'Bob' });

        expect(res.status).toBe(200);
        expect(res.body.assignee).toBe('Bob');
    });

    it('returns 404 when the task does not exist', async () => {
        const res = await request(app)
            .patch('/tasks/nonexistent-id/assign')
            .send({ assignee: 'Alice' });

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 400 when assignee is an empty string', async () => {
        const task = await createTask();

        const res = await request(app)
            .patch(`/tasks/${task.id}/assign`)
            .send({ assignee: '' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/assignee/i);
    });

    it('returns 400 when assignee is whitespace only', async () => {
        const task = await createTask();

        const res = await request(app)
            .patch(`/tasks/${task.id}/assign`)
            .send({ assignee: '   ' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/assignee/i);
    });

    it('returns 400 when assignee field is missing entirely', async () => {
        const task = await createTask();

        const res = await request(app)
            .patch(`/tasks/${task.id}/assign`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/assignee/i);
    });

    it('does not affect other task fields when assigning', async () => {
        const task = await createTask({
            title: 'Preserve me',
            priority: 'high',
            status: 'in_progress',
        });

        const res = await request(app)
            .patch(`/tasks/${task.id}/assign`)
            .send({ assignee: 'Carol' });

        expect(res.body.title).toBe('Preserve me');
        expect(res.body.priority).toBe('high');
        expect(res.body.status).toBe('in_progress');
    });
});
