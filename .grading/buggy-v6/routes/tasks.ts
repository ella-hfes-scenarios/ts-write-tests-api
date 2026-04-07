// BUGGY-V6: Pagination offset calculation is wrong (pageNum * limit instead of (pageNum-1) * limit)
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { title, description, status, priority } = req.body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ error: 'title is required' }); return;
  }
  const id = uuidv4();
  try {
    db.prepare('INSERT INTO tasks (id, title, description, status, priority) VALUES (?, ?, ?, ?, ?)')
      .run(id, title.trim(), description || '', status || 'todo', priority || 3);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.status(201).json({ data: task });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { status, sort, order, page, limit } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
  let whereClause = ''; const params: any[] = [];
  if (status) { whereClause = 'WHERE status = ?'; params.push(status); }
  const allowed = ['title', 'priority', 'created_at', 'updated_at', 'status'];
  const sortField = allowed.includes(sort as string) ? sort as string : 'created_at';
  const sortOrder = (order as string || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  // BUG: wrong offset calculation
  const offset = pageNum * limitNum; // should be (pageNum - 1) * limitNum
  try {
    const { total } = db.prepare(`SELECT COUNT(*) as total FROM tasks ${whereClause}`).get(...params) as any;
    const tasks = db.prepare(`SELECT * FROM tasks ${whereClause} ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`).all(...params, limitNum, offset);
    res.json({ data: tasks, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
  res.json({ data: task });
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { title, description, status, priority } = req.body;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Task not found' }); return; }
  const updates: string[] = []; const params: any[] = [];
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
  if (updates.length === 0) { res.json({ data: existing }); return; }
  updates.push("updated_at = datetime('now')"); params.push(req.params.id);
  try {
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json({ data: task });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
