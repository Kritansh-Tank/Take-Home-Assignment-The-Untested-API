# Bug Report

## Bug 1 — Pagination is off-by-one (page 1 skips all first results)

**File:** `task-api/src/services/taskService.js`, line 12

**Expected behavior:**  
`GET /tasks?page=1&limit=10` should return the first 10 tasks (items at indices 0–9).

**Actual behavior (before fix):**  
The offset was calculated as `page * limit`, so page 1 gave an offset of 10 — skipping the first 10 items entirely. Page 1 returned items 10–19, page 2 returned 20–29, and so on. Page 1 was effectively unreachable.

**How discovered:**  
Writing the integration test for `?page=1&limit=2` with 3 tasks in the store — the response was empty instead of containing the first two tasks. The offset formula `page * limit` (i.e., `1 * 10 = 10`) is a classic 0-vs-1-indexed pagination mistake.

**Fix applied:**

```diff
- const offset = page * limit;
+ const offset = (page - 1) * limit;  // 1-based: page 1 → offset 0
```

---

## Bug 2 — Status filter uses substring match instead of exact match

**File:** `task-api/src/services/taskService.js`, line 9

**Expected behavior:**  
`GET /tasks?status=todo` should return only tasks whose status is exactly `"todo"`.

**Actual behavior (before fix):**  
The filter used `t.status.includes(status)`, which is a substring check. This means:
- Searching for `"in"` would match `"in_progress"`.
- Searching for `"do"` would match `"done"`.
- Any partial string of a valid status would accidentally match.

This is a latent bug — it currently only surfaces with non-standard query values, but it violates the principle of least surprise and would cause problems if any future status shares a substring with another.

**How discovered:**  
During code review. Confirmed by unit test: `getByStatus('in')` with one `in_progress` task returned that task (length 1) before the fix, and correctly returns empty after.

**Fix applied:**

```diff
- const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
+ const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

---

## Bug 3 — `completeTask` silently resets priority to 'medium'

**File:** `task-api/src/services/taskService.js`, line 69

**Expected behavior:**  
`PATCH /tasks/:id/complete` should set `status: 'done'` and `completedAt` to the current timestamp. The task's `priority` should remain unchanged.

**Actual behavior (before fix):**  
The `completeTask` function included `priority: 'medium'` in the spread object unconditionally, overwriting whatever priority the task had. A `high`-priority task would silently become `medium` upon completion, with no error or warning to the caller.

**How discovered:**  
Code review of the `completeTask` function. Confirmed by unit test: creating a `priority: 'high'` task and calling `completeTask` returned `priority: 'medium'` before the fix.

This is the most insidious of the three bugs because it is a silent data corruption — the API returns 200 OK and the caller has no way to know the priority was mutated.

**Fix applied:**

```diff
  const updated = {
    ...task,
-   priority: 'medium',   // ← this line removed
    status: 'done',
    completedAt: new Date().toISOString(),
  };
```
