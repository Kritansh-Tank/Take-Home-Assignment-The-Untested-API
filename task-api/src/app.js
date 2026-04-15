/**
 * app.js
 *
 * Express application entry point.
 *
 * Responsibilities:
 *  - Mount JSON body-parsing middleware.
 *  - Register the /tasks router.
 *  - Provide a centralised error handler for uncaught errors.
 *  - Start the HTTP server when this file is run directly (not when imported
 *    by tests), so that Supertest can bind its own ephemeral port.
 */

const express = require('express');
const taskRoutes = require('./routes/tasks');

const app = express();

// Parse incoming JSON request bodies before any route handler sees them.
app.use(express.json());

// Mount all /tasks routes.
app.use('/tasks', taskRoutes);

/**
 * Centralised error handler.
 * Catches any error passed to `next(err)` in route handlers and returns a
 * generic 500 response so internal details are not leaked to clients.
 */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

// Only bind a port when this module is the Node entry point.
// When `require`d by tests, `require.main !== module` so no server is started.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Task API running on port ${PORT}`);
  });
}

module.exports = app;
