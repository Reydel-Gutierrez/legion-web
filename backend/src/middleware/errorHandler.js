const { Prisma } = require('@prisma/client');
const { HttpError } = require('../lib/httpError');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: 'A record with this unique field already exists',
      });
      return;
    }
  }

  const statusCode =
    err instanceof HttpError
      ? err.statusCode
      : err.statusCode || err.status || 500;

  const message =
    statusCode === 500 && !(err instanceof HttpError)
      ? 'Internal server error'
      : err.message || 'Internal server error';

  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: message,
  });
}

module.exports = { errorHandler };
