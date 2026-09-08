import { z } from 'zod';

/**
 * Inquiry shape — §5.15.
 *
 * Shared by the client form (for labels and option values) and the server action (for
 * validation). It holds no storage or delivery logic, so importing it into a client component
 * pulls no server code with it.
 */

export const INQUIRY_TYPES = ['enterprise', 'migration', 'training', 'partnership', 'general'] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];

export const ESTATE_SIZES = ['Not sure', '1–10', '11–50', '51–200', '200+'] as const;

export const InquirySchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(120, 'Name is too long.'),
  email: z.email('Enter an email address we can reply to.').max(254),
  inquiryType: z.enum(INQUIRY_TYPES),
  message: z
    .string()
    .trim()
    .min(10, 'Tell us a little more — at least 10 characters.')
    .max(5000, 'Message is too long; keep it under 5000 characters.'),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  role: z.string().trim().max(160).optional().or(z.literal('')),
  estateSize: z.enum(ESTATE_SIZES).optional(),
  /** Honeypot: a real person leaves this empty. */
  website: z.string().max(0, 'Submission rejected.').optional().or(z.literal('')),
  /** Idempotency key: a retry of the same submission reuses one inquiry ID. */
  submissionKey: z.uuid().optional(),
});

export type InquiryInput = z.infer<typeof InquirySchema>;
