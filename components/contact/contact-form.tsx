'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { submitInquiry, type ContactState } from '@/app/contact/actions';
import { ESTATE_SIZES, INQUIRY_TYPES } from '@/lib/inquiry-schema';

/**
 * Contact form — §5.15, §6.6.
 *
 * Values survive a failure, inline errors are associated with their fields, and an error summary
 * receives focus. UI states are editing, submitting, accepted, retryable failure and validation
 * failure.
 */

const TYPE_LABELS: Record<(typeof INQUIRY_TYPES)[number], string> = {
  enterprise: 'Enterprise inquiry',
  migration: 'Migration discussion',
  training: 'Training',
  partnership: 'Partnership',
  general: 'General',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-signal px-6 py-3 text-sm font-semibold text-ink disabled:opacity-50"
    >
      {pending ? 'Sending…' : 'Send inquiry'}
    </button>
  );
}

export function ContactForm({ initialIntent }: { initialIntent?: string }) {
  const initial: ContactState = { status: 'editing' };
  const [state, action] = useActionState(submitInquiry, initial);
  const summaryRef = useRef<HTMLDivElement>(null);

  // A fresh idempotency key per mounted form: a retry of the same submission is not a duplicate.
  const submissionKey = useMemo(() => globalThis.crypto.randomUUID(), []);

  useEffect(() => {
    if (state.status === 'validation-error' || state.status === 'retryable-error') {
      summaryRef.current?.focus();
    }
  }, [state.status]);

  if (state.status === 'accepted') {
    return (
      <div role="status" className="rounded-lg border border-signal/40 bg-ink-2 p-6">
        <h2 className="font-display text-xl font-semibold">Your inquiry was received.</h2>
        <p className="mt-2 text-sm text-muted">
          Reference <span className="font-mono text-xs text-text">{state.inquiryId}</span>. Keep it if
          you need to follow up.
        </p>
        {state.deliveryConfigured ? (
          <p className="mt-3 text-sm text-muted">
            It has been queued for delivery to our team. You will get a reply at the address you gave.
          </p>
        ) : (
          <p className="mt-3 text-sm text-telemetry">
            Delivery is not configured in this deployment, so the inquiry has been recorded but not
            emailed. This is stated plainly rather than acknowledged as sent.
          </p>
        )}
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const describedBy = (field: string) => (errors[field] ? `${field}-error` : undefined);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="submissionKey" value={submissionKey} />

      {state.message ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded border border-failure/50 bg-ink-2 p-4 text-sm"
        >
          <p className="font-semibold">{state.message}</p>
          {Object.keys(errors).length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-muted">
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>
                  <a href={`#${field}`} className="underline">
                    {error}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Name <span className="text-muted">(required)</span>
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={values.name ?? ''}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy('name')}
            className="mt-2 w-full rounded border border-grid-line bg-ink px-3 py-2"
          />
          {errors.name ? (
            <p id="name-error" className="mt-1 text-sm text-failure">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email <span className="text-muted">(required)</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={values.email ?? ''}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy('email')}
            className="mt-2 w-full rounded border border-grid-line bg-ink px-3 py-2"
          />
          {errors.email ? (
            <p id="email-error" className="mt-1 text-sm text-failure">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="company" className="block text-sm font-medium">
            Company <span className="text-muted">(optional)</span>
          </label>
          <input
            id="company"
            name="company"
            defaultValue={values.company ?? ''}
            className="mt-2 w-full rounded border border-grid-line bg-ink px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium">
            Role <span className="text-muted">(optional)</span>
          </label>
          <input
            id="role"
            name="role"
            defaultValue={values.role ?? ''}
            className="mt-2 w-full rounded border border-grid-line bg-ink px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="inquiryType" className="block text-sm font-medium">
            Inquiry type <span className="text-muted">(required)</span>
          </label>
          <select
            id="inquiryType"
            name="inquiryType"
            defaultValue={values.inquiryType ?? initialIntent ?? 'general'}
            aria-invalid={Boolean(errors.inquiryType)}
            aria-describedby={describedBy('inquiryType')}
            className="mt-2 w-full rounded border border-grid-line bg-ink px-3 py-2"
          >
            {INQUIRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          {errors.inquiryType ? (
            <p id="inquiryType-error" className="mt-1 text-sm text-failure">
              {errors.inquiryType}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="estateSize" className="block text-sm font-medium">
            Capability estate size <span className="text-muted">(optional)</span>
          </label>
          <select
            id="estateSize"
            name="estateSize"
            defaultValue={values.estateSize ?? 'Not sure'}
            className="mt-2 w-full rounded border border-grid-line bg-ink px-3 py-2"
          >
            {ESTATE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium">
          Message <span className="text-muted">(required)</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          defaultValue={values.message ?? ''}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy('message')}
          className="mt-2 w-full rounded border border-grid-line bg-ink px-3 py-2"
        />
        {errors.message ? (
          <p id="message-error" className="mt-1 text-sm text-failure">
            {errors.message}
          </p>
        ) : null}
      </div>

      {/* Honeypot: visually hidden and hidden from assistive technology. */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <SubmitButton />
    </form>
  );
}
