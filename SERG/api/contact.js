const CONTACT_MIN_SUBMIT_DELAY_MS = Number(process.env.CONTACT_MIN_SUBMIT_DELAY_MS || 1500);
const MAX_NAME_LENGTH = Number(process.env.CONTACT_MAX_NAME_LENGTH || 80);
const MAX_EMAIL_LENGTH = Number(process.env.CONTACT_MAX_EMAIL_LENGTH || 254);
const MAX_SUBJECT_LENGTH = Number(process.env.CONTACT_MAX_SUBJECT_LENGTH || 120);
const MAX_MESSAGE_LENGTH = Number(process.env.CONTACT_MAX_MESSAGE_LENGTH || 2000);

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;

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

  return { name, email, subject, message, website, formStartedAt };
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

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
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
  const submissionAgeMs = Number.isFinite(payload.formStartedAt)
    ? Date.now() - payload.formStartedAt
    : Infinity;

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

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Contact delivery error:', error);
    return res.status(502).json({
      error: 'Message delivery failed. Please try again later.',
    });
  }
};
