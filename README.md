# Task Management API Test-Writing Challenge

## Background

You've been handed a task management REST API built with Express and SQLite. The API has no tests. Your job is to write a comprehensive test suite using Jest and Supertest.

## Your Task

Write tests in `tests/visible/` that thoroughly cover the API:

1. Verify all CRUD operations work correctly
2. Test validation and error handling
3. Cover edge cases (missing fields, invalid data, not-found scenarios)
4. Test query parameters (filtering, sorting, pagination)
5. Look for potential security issues

## Getting Started

```bash
npm install
npm test          # Run your tests
```

## API Endpoints

### Tasks

#### `POST /api/tasks` — Create a task
```json
{
  "title": "Buy groceries",       // required, string
  "description": "Milk and eggs",  // optional, string
  "status": "todo",                // optional, "todo"|"in_progress"|"done" (default: "todo")
  "priority": 2                    // optional, 1-5 (default: 3)
}
```
Returns: `201` with created task (includes `id`, `createdAt`, `updatedAt`)

#### `GET /api/tasks` — List tasks
Query parameters:
- `status` — Filter by status ("todo", "in_progress", "done")
- `sort` — Sort by field ("title", "priority", "createdAt")
- `order` — Sort direction ("asc", "desc") — default "asc"
- `page` — Page number (default: 1)
- `limit` — Items per page (default: 10, max: 100)

Returns: `200` with `{ data: Task[], pagination: { page, limit, total, totalPages } }`

#### `GET /api/tasks/:id` — Get a single task
Returns: `200` with task or `404`

#### `PUT /api/tasks/:id` — Update a task
Accepts partial updates. Returns: `200` with updated task or `404`

#### `DELETE /api/tasks/:id` — Delete a task
Returns: `204` on success or `404`

## Database Schema

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done')),
  priority INTEGER DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

## Tips

- Each test should be independent — use `beforeEach` to reset state
- Test both success and failure cases
- Pay attention to response status codes
- Check response body structure, not just status codes
- Think about what could go wrong with sorting, filtering, and pagination
