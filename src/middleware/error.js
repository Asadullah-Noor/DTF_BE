export function notFound(_req, res) {
  res.status(404).json({ message: 'Route not found' });
}

export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message;

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id or value';
  } else if (err.code === 11000) {
    status = 409;
    message = 'Already exists (duplicate)';
  } else if (err.name === 'MulterError') {
    status = 400;
  }

  if (status === 500) {
    console.error(err);
    message = 'Server error';
  }
  res.status(status).json({ message });
}