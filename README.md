# Take-Home Assignment — The Untested API

A 2-day take-home assignment. You'll read unfamiliar code, write tests, track down bugs, and ship a small feature.

Read **[ASSIGNMENT.md](./ASSIGNMENT.md)** for the full brief before you start.

---

## A note on AI tools

You're welcome to use AI tools. What we're evaluating is your ability to read and reason about unfamiliar code — so your submission should reflect your own understanding, not just generated output.

Concretely:
- For each bug you report: include where in the code it lives and why it happens
- For the feature you implement: briefly explain the design decisions you made
- If something surprised you or you had to make a tradeoff, say so

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
cd task-api
npm install
npm start        # runs on http://localhost:3000
```

**Tests:**

```bash
npm test           # run test suite
npm run coverage   # run with coverage report
```

---

## Project Structure

```
task-api/
  src/
    app.js                  # Express app setup
    routes/tasks.js         # Route handlers
    services/taskService.js # Business logic + in-memory data store
    utils/validators.js     # Input validation helpers
  tests/                    # Your tests go here
  package.json
  jest.config.js
ASSIGNMENT.md               # Full brief — read this first
```

> The data store is in-memory. It resets every time the server restarts.

---

## API Reference

| Method   | Path                      | Description                              |
|----------|---------------------------|------------------------------------------|
| `GET`    | `/tasks`                  | List all tasks. Supports `?status=`, `?page=`, `?limit=` |
| `POST`   | `/tasks`                  | Create a new task                        |
| `PUT`    | `/tasks/:id`              | Full update of a task                    |
| `DELETE` | `/tasks/:id`              | Delete a task (returns 204)              |
| `PATCH`  | `/tasks/:id/complete`     | Mark a task as complete                  |
| `GET`    | `/tasks/stats`            | Counts by status + overdue count         |
| `PATCH`  | `/tasks/:id/assign`       | Assign a task to a user. Body: `{ "assignee": "string" }` |

### Task shape

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "pending | in-progress | completed",
  "priority": "low | medium | high",
  "dueDate": "ISO 8601 or null",
  "completedAt": "ISO 8601 or null",
  "createdAt": "ISO 8601"
}
```

### Sample requests

**Create a task**
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Write tests", "priority": "high"}'
```

**List tasks with filter**
```bash
curl "http://localhost:3000/tasks?status=pending&page=1&limit=10"
```

**Mark complete**
```bash
curl -X PATCH http://localhost:3000/tasks/<id>/complete
```

---

## What to Submit

See [ASSIGNMENT.md](./ASSIGNMENT.md) for full submission requirements. At minimum, include:

- **Test files** — covering the endpoints and edge cases you identified
- **Bug report** — what you found, where in the code, and why it's a bug (not just symptoms)
- **At least one fix** — with a note on your approach
- **`PATCH /tasks/:id/assign` implementation** — plus a short explanation of any design decisions (validation, edge cases, etc.)

---

## Submission Notes

### What I'd test next if I had more time

- **Invalid UUID format inputs** — every `/:id` route currently passes the string directly to the service without validating UUID format. A malformed id (e.g. `../../../etc`) should probably be rejected at the route level with a 400.
- **Concurrent writes** — the in-memory store is a plain array. Tests with parallel requests could surface race conditions if this moved to async storage.
- **Boundary pagination** — limit=0, page=0, or extremely large page numbers; currently these produce surprising results (limit=0 returns nothing, page=0 returns page of results due to `|| 1` default, etc.).
- **Stats accuracy under rapid mutation** — create, complete, delete in rapid succession to ensure the overdue count stays consistent.
- **`?status=` with unknown values** — currently returns an empty array silently. It might make more sense to return a 400 when status is not one of the valid values.

### Things that surprised me

- `completeTask` unconditionally resetting `priority: 'medium'` is the most surprising find — it is silent data corruption. There's no test warning, the response is 200 OK, and clients have no way to detect it. It looks like either a misplaced default or a leftover from an older spec.
- The pagination offset bug is a very easy mistake to make and very hard to spot without tests, especially when the front-end team might just notice "page 2 looks right" without checking page 1 on an empty-ish dataset.
- The in-memory store exports `_reset` as part of the public module interface, which is a pragmatic pattern for test isolation that I appreciated.

### Questions I'd ask before shipping to production

1. **Authentication / authorisation** — who can create, delete, or assign tasks? There's no auth middleware at all. Should assignees be validated against a user list?
2. **Persistence** — the in-memory store resets on every restart. Is the expectation to wire up a database before this ships, or is restart-safety not a concern?
3. **Status transitions** — should the API enforce a state machine (e.g. `todo → in_progress → done` only)? Currently any status can be set at any time, including setting a `done` task back to `todo` via PUT.
4. **Assignee ownership** — should only the current assignee be able to reassign or complete the task?
5. **Soft deletes** — `DELETE` permanently removes the record. Is there an audit / history requirement?

