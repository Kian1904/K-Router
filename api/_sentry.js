'use strict';

// api/_sentry.js
// Sentry init untuk semua Vercel serverless functions.
// Di-require sekali di tiap API file.

const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV || 'production',
  tracesSampleRate: 0.1,

  beforeSend(event) {
    // Strip request body — jangan kirim messages/payload ke Sentry
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
    }
    // Strip user context
    delete event.user;
    return event;
  }
});

module.exports = Sentry;
