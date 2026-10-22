import express from 'express';

export function createApp(pool) {
  const app = express();
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  app.get('/notes', async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM notes ORDER BY id');
    res.json(rows);
  });

  app.post('/notes', async (req, res) => {
    const note = parseNote(req.body);
    if (!note) return res.status(400).json({ error: 'title and content are required strings' });
    const { rows } = await pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [note.title, note.content],
    );
    res.status(201).json(rows[0]);
  });

  app.get('/notes/:id', validId, async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', [req.noteId]);
    return rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'note not found' });
  });

  app.put('/notes/:id', validId, async (req, res) => {
    const note = parseNote(req.body);
    if (!note) return res.status(400).json({ error: 'title and content are required strings' });
    const { rows } = await pool.query(
      'UPDATE notes SET title = $1, content = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [note.title, note.content, req.noteId],
    );
    return rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'note not found' });
  });

  app.delete('/notes/:id', validId, async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM notes WHERE id = $1', [req.noteId]);
    return rowCount ? res.status(204).end() : res.status(404).json({ error: 'note not found' });
  });

  app.use((err, _req, res, _next) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'invalid JSON body' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'request body is too large' });
    }
    if (res.headersSent) return;
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

function parseNote(body) {
  if (!body || typeof body.title !== 'string' || typeof body.content !== 'string') return null;
  const title = body.title.trim();
  if (!title || !body.content.trim()) return null;
  return { title, content: body.content };
}

function validId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'id must be a positive integer' });
  req.noteId = id;
  next();
}
