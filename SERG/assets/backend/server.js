const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const SITE_ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 3000);
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '10kb';
const CONTACT_RATE_LIMIT_WINDOW_MS = Number(process.env.CONTACT_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const CONTACT_RATE_LIMIT_MAX = Number(process.env.CONTACT_RATE_LIMIT_MAX || 5);
const CONTACT_MIN_SUBMIT_DELAY_MS = Number(process.env.CONTACT_MIN_SUBMIT_DELAY_MS || 1500);
const MAX_NAME_LENGTH = Number(process.env.CONTACT_MAX_NAME_LENGTH || 80);
const MAX_EMAIL_LENGTH = Number(process.env.CONTACT_MAX_EMAIL_LENGTH || 254);
const MAX_SUBJECT_LENGTH = Number(process.env.CONTACT_MAX_SUBJECT_LENGTH || 120);
const MAX_MESSAGE_LENGTH = Number(process.env.CONTACT_MAX_MESSAGE_LENGTH || 2000);

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;

const submissions = new Map();

app.disable('x-powered-by');
app.set('trust proxy', 1);

function cleanupSubmissions(now = Date.now()) {
  for (const [ip, timestamps] of submissions.entries()) {
    const recent = timestamps.filter((timestamp) => now - timestamp < CONTACT_RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      submissions.delete(ip);
    } else {
      submissions.set(ip, recent);
    }
  }
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function setSecurityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://api.emailjs.com",
      "img-src 'self' data: https:",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
      "connect-src 'self' https://api.emailjs.com",
    ].join('; ')
  );
  next();
}

function normalizeText(value, { preserveNewlines = false, maxLength = Infinity } = {}) {
  let text = String(value ?? '').normalize('NFKC');

  if (preserveNewlines) {
    text = text
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
  } else {
    text = text
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (Number.isFinite(maxLength)) {
    text = text.slice(0, maxLength);
  }

  return text;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

function isLikelyEmail(value) {
  if (!value || value.length > MAX_EMAIL_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value);
}

function isLikelyName(value) {
  return /^[\p{L}\p{M}\p{N}\s.'-]{2,80}$/u.test(value);
}

function parseContactPayload(body) {
  const name = normalizeText(body.name, { maxLength: MAX_NAME_LENGTH });
  const email = normalizeText(body.email, { maxLength: MAX_EMAIL_LENGTH });
  const subject = normalizeText(body.subject, { maxLength: MAX_SUBJECT_LENGTH });
  const message = normalizeText(body.message, {
    preserveNewlines: true,
    maxLength: MAX_MESSAGE_LENGTH,
  });
  const website = normalizeText(body.website, { maxLength: 120 });
  const formStartedAt = Number(body.formStartedAt ?? body.form_started_at ?? 0);

  return {
    name,
    email,
    subject,
    message,
    website,
    formStartedAt,
  };
}

function validateContactPayload(payload) {
  const errors = {};

  if (!payload.name) {
    errors.name = 'Please enter your name.';
  } else if (!isLikelyName(payload.name)) {
    errors.name = 'Name contains unsupported characters.';
  }

  if (!payload.email) {
    errors.email = 'Please enter your email address.';
  } else if (!isLikelyEmail(payload.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!payload.subject) {
    errors.subject = 'Please enter a subject.';
  } else if (payload.subject.length < 2) {
    errors.subject = 'Subject must be at least 2 characters long.';
  }

  if (!payload.message) {
    errors.message = 'Please enter a message.';
  } else if (payload.message.length < 10) {
    errors.message = 'Message must be at least 10 characters long.';
  }

  if (payload.name.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  if (payload.subject.length > MAX_SUBJECT_LENGTH) {
    errors.subject = `Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer.`;
  }

  if (payload.message.length > MAX_MESSAGE_LENGTH) {
    errors.message = `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`;
  }

  return errors;
}

function buildEmailTemplateParams(payload) {
  return {
    name: escapeHtml(payload.name),
    email: escapeHtml(payload.email),
    subject: escapeHtml(payload.subject),
    message: escapeHtml(payload.message),
    reply_to: escapeHtml(payload.email),
  };
}

function rateLimitContact(req, res, next) {
  cleanupSubmissions();

  const ip = getClientIp(req);
  const timestamps = submissions.get(ip) || [];
  const now = Date.now();
  const recent = timestamps.filter((timestamp) => now - timestamp < CONTACT_RATE_LIMIT_WINDOW_MS);

  if (recent.length >= CONTACT_RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.max(1, Math.ceil(CONTACT_RATE_LIMIT_WINDOW_MS / 1000));
    return res.status(429).set('Retry-After', String(retryAfterSeconds)).json({
      error: 'You are sending messages too quickly. Please wait and try again.',
    });
  }

  recent.push(now);
  submissions.set(ip, recent);
  next();
}

app.use(setSecurityHeaders);
app.use(express.json({ limit: REQUEST_BODY_LIMIT, strict: true, type: 'application/json' }));
app.use(express.urlencoded({ extended: false, limit: REQUEST_BODY_LIMIT }));

app.use(
  express.static(SITE_ROOT, {
    extensions: ['html'],
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/contact', rateLimitContact, async (req, res) => {
  if (req.is('application/json') !== 'application/json') {
    return res.status(415).json({
      error: 'Only JSON requests are accepted.',
    });
  }

  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    return res.status(503).json({
      error: 'Contact service is not configured.',
    });
  }

  const payload = parseContactPayload(req.body || {});
  const errors = validateContactPayload(payload);
  const submissionAgeMs = Number.isFinite(payload.formStartedAt) ? Date.now() - payload.formStartedAt : Infinity;

  if (payload.website) {
    return res.status(200).json({ ok: true });
  }

  if (submissionAgeMs < CONTACT_MIN_SUBMIT_DELAY_MS) {
    return res.status(429).set('Retry-After', '2').json({
      error: 'Please take a moment before sending again.',
    });
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: 'Please check the highlighted fields.',
      details: errors,
    });
  }

  try {
    const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: buildEmailTemplateParams(payload),
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('EmailJS request failed:', emailResponse.status, errorText);
      return res.status(502).json({
        error: 'Message delivery failed. Please try again later.',
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Contact delivery error:', error);
    return res.status(502).json({
      error: 'Message delivery failed. Please try again later.',
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found.',
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: 'Internal server error.',
  });
});

app.listen(PORT, () => {
  console.log(`Portfolio backend running at http://localhost:${PORT}`);
});
