import 'server-only';

import { randomUUID } from 'node:crypto';

import type { InquiryInput } from './inquiry-schema';

/**
 * Inquiry recording and rate limiting — §5.15.
 *
 * Development-only receipt and rate-limit primitives. This Map is not durable. Production
 * submitInquiry rejects input until a real store and delivery worker replace these primitives.
 */

interface StoredInquiry {
  inquiryId: string;
  receivedAt: string;
  deliveryState: 'QUEUED' | 'DELIVERED' | 'FAILED';
  input: InquiryInput;
}

/**
 * Development-time store. A production deployment replaces this with a durable store and a
 * delivery worker; without one, the action reports that delivery is not configured rather than
 * claiming an inquiry was sent.
 */
const inquiries = new Map<string, StoredInquiry>();
const bySubmissionKey = new Map<string, string>();

/** Fixed-window rate limit per client key. Bounded and in-memory for this build. */
const RATE_LIMIT = { windowMs: 60_000, max: 5 };
const hits = new Map<string, { count: number; windowStart: number }>();

export function rateLimit(clientKey: string): boolean {
  const now = Date.now();
  const entry = hits.get(clientKey);
  if (!entry || now - entry.windowStart > RATE_LIMIT.windowMs) {
    hits.set(clientKey, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT.max) return false;
  entry.count += 1;
  return true;
}

export function deliveryConfigured(): boolean {
  // Configuration values alone do not implement a durable store or mail worker.
  return false;
}

/**
 * Stores a development inquiry in memory and returns its identity. An idempotent retry
 * returns the existing record rather than creating a duplicate.
 */
export function recordInquiry(input: InquiryInput): StoredInquiry {
  if (input.submissionKey) {
    const existingId = bySubmissionKey.get(input.submissionKey);
    if (existingId) {
      const stored = inquiries.get(existingId);
      if (stored) return stored;
    }
  }

  const stored: StoredInquiry = {
    inquiryId: randomUUID(),
    receivedAt: new Date().toISOString(),
    deliveryState: 'QUEUED',
    input,
  };
  inquiries.set(stored.inquiryId, stored);
  if (input.submissionKey) bySubmissionKey.set(input.submissionKey, stored.inquiryId);
  return stored;
}

export function getInquiry(inquiryId: string): StoredInquiry | undefined {
  return inquiries.get(inquiryId);
}
