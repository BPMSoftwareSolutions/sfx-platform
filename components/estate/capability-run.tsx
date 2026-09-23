import type { CapabilityPage } from '@/contracts/estate';
import type { ResolvedInputContract } from '@/contracts/input-contract';
import { Callout } from '@/components/ui';
import { CapabilityRunPanel } from './capability-run-panel';

/**
 * Capability execution section — §5.17, §13.1.
 *
 * Offered for every published capability, because the run API accepts any declared capability
 * identity: whether one can execute is the estate's answer, given when the visitor runs it,
 * not a claim this page makes in advance.
 *
 * Availability is deliberately not resolved while rendering. These pages are prerendered and one
 * image is promoted between environments, so the run endpoint is server-side runtime
 * configuration; a deployment without one reports that when the visitor runs.
 */
export function CapabilityRun({
  capability,
  contract,
  example,
}: {
  capability: CapabilityPage;
  contract: ResolvedInputContract;
  example: string | null;
}) {
  return (
    <section className="page-width editorial-section" aria-labelledby="capability-execution-title" id="execute">
      <div className="editorial-heading">
        <div>
          <p className="kicker">03 / Run it</p>
          <h2 id="capability-execution-title">Meaning you can<br /><em>execute.</em></h2>
        </div>
        <p>
          Run this capability against an input you supply. The platform admits the run through the
          SDA run API, watches the observation lane advance — the circuit nodes above take their
          live state from what is observed — and shows the lean scenario output the run produced.
        </p>
      </div>

      <CapabilityRunPanel
        namespace={capability.urlNamespace}
        capabilityId={capability.entityId}
        contractId={contract.contractId}
        schema={contract.schema}
        example={example}
      />

      <Callout tone="limitation" title="What an execution here establishes, and what it does not">
        <p>
          Execution reads the selected authority from SQL, plans the capability&apos;s body in
          memory and runs it through the Scenario Kernel. Preparation is an optional separate proof.
          Provider effects depend on the capability&apos;s declared bindings.
        </p>
        <p className="mt-2">
          A completed execution is not managed admission and not a conformance result; those remain
          separately unevaluated (§1.7). A capability whose requirements or bindings do not resolve
          reports the missing requirement or binding and does not execute.
        </p>
      </Callout>
    </section>
  );
}
