import type { InvocationView } from './invocation';

export type JsonObject = Record<string, unknown>;
export interface InputBinding {
  pointer: string;
  ownership: 'fixed' | 'derived' | 'editable' | 'system-bound';
  value?: unknown;
  construction?: string;
  control?: string;
  label?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
  trim?: boolean;
  unicodeNormalization?: string;
  source?: string;
  includesDescendants?: boolean;
}
export interface LabProfile {
  subject: string;
  namespace: string;
  label: string;
  description: string;
  inputContract: string;
  inputSchemaDigest: string;
  interaction: 'action' | 'form' | 'retained-example-selection';
  inputs: InputBinding[];
  outcome: {
    contract: string; schemaDigest: string; view: 'text' | 'structured-result'; pointer?: string;
    summaryPointers?: string[]; collectionPointers?: string[]; tracePointers?: string[];
    collectionFields?: Record<string, string[]>;
    domainLabels?: Record<string, string>; managedAdmission?: string; externalProviderInvoked?: boolean;
    resolvedDisposition?: string;
  };
  exampleSource?: { sourcePath: string; digest: string; allowedFixtureIds: string[] };
  exampleLabels?: Record<string, string>;
}
export interface SchemaResource { sourcePath: string; digest: string; text: string }
export interface LabPilot {
  profile: LabProfile;
  resources: SchemaResource[];
  inputSchema: JsonObject;
  outcomeSchema: JsonObject;
  examples: { id: string; label: string; input: unknown }[];
  authority: { snapshotId: string; projectionDigest: string; scenarioId: string; identity: Record<string, string> };
}
export interface LabPublication { publicationId: string; compiler: string; pilots: LabPilot[] }
export interface PublicPilot { profile: LabProfile; examples: { id: string; label: string }[] }
export interface LabRequest { publicationId: string; subject: string; values: Record<string, unknown>; exampleId?: string }
export type LabResult = InvocationView;
