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
    if (err.code === 'P2021') {
      res.status(503).json({
        error:
          'Database is missing tables for this feature. On the API server run: npx prisma migrate deploy',
      });
      return;
    }
  }

  const msg = err && err.message ? String(err.message) : '';
  if (msg.includes('Could not find mapping for model')) {
    res.status(503).json({
      error:
        'API Prisma client is out of date. Stop the server, then run: npx prisma generate && restart',
    });
    return;
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

  const body = { error: message };
  if (
    process.env.NODE_ENV !== 'production' &&
    statusCode === 500 &&
    err &&
    !(err instanceof HttpError) &&
    err.message
  ) {
    body.detail = String(err.message);
  }

  res.status(statusCode).json(body);
}

module.exports = { errorHandler };
