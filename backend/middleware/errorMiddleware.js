/**
 * Central error handling. Converts Mongoose errors into clean 4xx responses
 * and never leaks stack traces or internals to the client (NFR-14, NFR-22).
 */

function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate value - record already exists';
  }

  if (status === 500) {
    console.error(err);
    message = 'Internal server error';
  }

  res.status(status).json({ message });
}

/** Small helper to create an error carrying an HTTP status code */
function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { notFound, errorHandler, httpError };
