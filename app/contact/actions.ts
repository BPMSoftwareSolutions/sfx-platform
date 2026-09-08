'use server';

import { headers } from 'next/headers';

import { deliveryConfigured, rateLimit, recordInquiry } from '@/lib/inquiries';
import { InquirySchema } from '@/lib/inquiry-schema';

/**
 * Contact server action — §5.15.
 *
 * The action validates, rate-limits and records. It returns field-level errors with the values
 * preserved, so a failure never empties the form. Acceptance states that the inquiry was
 * received and queued; it does not assert that email was delivered.
 */

export interface ContactState {
  status: 'editing' | 'accepted' | 'validation-error' | 'retryable-error';
  inquiryId?: string;
  /** Whether a delivery route is configured. Reported honestly on the acknowledgement. */
  deliveryConfigured?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Values echoed back so nothing the visitor typed is lost on failure. */
  values?: Record<string, string>;
}

export async function submitInquiry(_previous: ContactState, formData: FormData): Promise<ContactState> {
  const values = Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  ) as Record<string, string>;

  // The honeypot value is never echoed back into the rendered form.
  const echo = { ...values };
  delete echo.website;

  const headerList = await headers();
  const clientKey = headerList.get('x-forwarded-for') ?? 'local';
  if (!rateLimit(clientKey)) {
    return {
      status: 'retryable-error',
      message: 'Too many submissions from this connection. Wait a minute and try again.',
      values: echo,
    };
  }

  const parsed = InquirySchema.safeParse({
    ...values,
    estateSize: values.estateSize || undefined,
    submissionKey: values.submissionKey || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? 'form');
      fieldErrors[field] ??= issue.message;
    }
    return {
      status: 'validation-error',
      message: 'Some details need attention before we can accept this inquiry.',
      fieldErrors,
      values: echo,
    };
  }

  // The current store is process-local and has no delivery worker. Hosted builds must not
  // acknowledge durable receipt until that adapter exists, even if mail env vars are present.
  if (process.env.NODE_ENV === 'production') {
    return {
      status: 'retryable-error',
      message: 'Contact delivery is not available yet. Your message has not been submitted; keep a copy and try again later.',
      values: echo,
    };
  }

  try {
    const stored = recordInquiry(parsed.data);
    return {
      status: 'accepted',
      inquiryId: stored.inquiryId,
      deliveryConfigured: deliveryConfigured(),
    };
  } catch {
    return {
      status: 'retryable-error',
      message: 'We could not record this inquiry. Nothing has been lost — try again.',
      values: echo,
    };
  }
}
