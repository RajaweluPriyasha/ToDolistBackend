const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/db'); // Import database
const authenticate = require('../middleware/auth'); // Import authentication middleware

const router = express.Router();
const secretKey = 'your-secret-key'; // Replace with a strong secret key

// User Registration
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });

  const hashedPassword = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
    if (err) return res.status(400).json({ message: 'Username already exists.' });
    res.status(201).json({ message: 'User registered successfully.' });
  });
});

// User Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) return res.status(400).json({ message: 'Invalid username or password.' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ message: 'Invalid username or password.' });

    const token = jwt.sign({ userId: user.id }, secretKey, { expiresIn: '1h' });
    res.json({ token });
  });
});

// Task Routes (Protected by Authentication)
router.use(authenticate);

// Get All Tasks
router.get('/tasks', (req, res) => {
  db.all('SELECT * FROM tasks WHERE user_id = ?', [req.userId], (err, tasks) => {
    if (err) return res.status(500).json({ message: 'Database error.' });

    // Map tasks to include a default due_date if null
    const formattedTasks = tasks.map(task => ({
      ...task,
      due_date: task.due_date || 'No due date', // Replace null with 'No due date'
    }));

    res.json(formattedTasks);
  });
});

// Add a Task
router.post('/tasks', (req, res) => {
  const { description, due_date } = req.body;
  if (!description) return res.status(400).json({ message: 'Task description is required.' });

  // If due_date is not provided, set it to null
  const taskDueDate = due_date || null;

  db.run(
    'INSERT INTO tasks (user_id, description, due_date) VALUES (?, ?, ?)',
    [req.userId, description, taskDueDate],
    (err) => {
      if (err) return res.status(500).json({ message: 'Database error.' });
      res.status(201).json({ message: 'Task added successfully.' });
    }
  );
});

// Delete a Task
router.delete('/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, req.userId], (err) => {
    if (err) return res.status(500).json({ message: 'Database error.' });
    res.json({ message: 'Task deleted successfully.' });
  });
});

// Update task status and due_date
router.put('/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const { status, due_date } = req.body;

  // Validate the status
  if (!status || !['pending', 'completed'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Status must be "pending" or "completed".' });
  }

  // Update the task status and due_date in the database
  db.run(
    'UPDATE tasks SET status = ?, due_date = ? WHERE id = ? AND user_id = ?',
    [status, due_date || null, taskId, req.userId],
    (err) => {
      if (err) return res.status(500).json({ message: 'Database error.' });
      res.json({ message: 'Task updated successfully.' });
    }
  );
});

module.exports = router;