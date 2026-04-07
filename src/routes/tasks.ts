import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';

const router = Router();

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: number;
  created_at: string;
  updated_at: string;
}

// POST /api/tasks — Create a task
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { title, description, status, priority } = req.body;

  const id = uuidv4();
  const taskStatus = status || 'todo';
  const taskPriority = priority || 3;
  const taskDescription = description || '';

  try {
    const stmt = db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, title || '', taskDescription, taskStatus, taskPriority);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
    res.status(201).json({ data: task });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/tasks — List tasks with filtering, sorting, pagination
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { status, sort, order, page, limit } = req.query;

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));

  let whereClause = '';
  const params: any[] = [];

  if (status) {
    whereClause = `WHERE 1=1`;
  }

  const sortField = sort as string || 'created_at';
  const sortOrder = (order as string || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const offset = pageNum * limitNum;

  try {
    const countSql = `SELECT COUNT(*) as total FROM tasks ${whereClause}`;
    const { total } = db.prepare(countSql).get(...params) as { total: number };

    const sql = `SELECT * FROM tasks ${whereClause} ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
    const tasks = db.prepare(sql).all(...params, limitNum, offset) as Task[];

    res.json({
      data: tasks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/tasks/:id — Get a single task
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json({ data: task });
});

// PUT /api/tasks/:id — Update a task
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { title, description, status, priority } = req.body;

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;

  const updates: string[] = [];
  const params: any[] = [];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }
  if (priority !== undefined) {
    updates.push('priority = ?');
    params.push(priority);
  }

  if (updates.length === 0) {
    res.json({ data: existing || {} });
    return;
  }

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  try {
    const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
    res.json({ data: task || {} });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id — Delete a task
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  db.prepare('DELETE FROM tasks WHERE id = ?');

  res.status(204).send();
});

export default router;
