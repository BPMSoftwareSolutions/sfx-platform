import { getEstateStatus } from '@/lib/estate';
import { Callout } from '@/components/ui';

/**
 * Publication status — §11.4.
 *
 * Stale and unavailable states are explicit. With no valid publication the site says so and
 * dependent actions are disabled; it never substitutes an empty catalog for a missing one.
 */
export function EstateStatusNotice() {
  const status = getEstateStatus();

  if (status.state === 'UNAVAILABLE') {
    return (
      <Callout tone="unavailable" title="Estate content is unavailable">
        <p>{status.reason}</p>
        <p className="mt-2">
          Capability, mechanic and provider pages are not being served from a valid publication, so
          catalog browsing and downloads are disabled.
        </p>
      </Callout>
    );
  }

  if (status.state === 'STALE') {
    return (
      <Callout tone="limitation" title="This estate publication is older than the configured maximum age">
        <p>
          The content below was read from the selected model on{' '}
          <strong>{status.publication.source.observedAt.slice(0, 10)}</strong>, {status.ageDays} days
          ago. It is shown as last published; it may not reflect the current estate.
        </p>
      </Callout>
    );
  }

  return null;
}

/** The provenance line shown wherever estate-derived counts or records appear (§11.2). */
export function PublicationProvenance() {
  const status = getEstateStatus();
  if (status.state === 'UNAVAILABLE') return null;
  const { publication } = status;

  return (
    <p className="mt-6 font-mono text-xs text-muted">
      Published generation {publication.publicationId.slice(7, 19)} · selected model{' '}
      {publication.source.estateModelPk} · observed {publication.source.observedAt.slice(0, 10)} ·{' '}
      {publication.source.disposition}
    </p>
  );
}
