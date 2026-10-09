// Receipt-derived locations. Never derive progress from array position, time elapsed,
// a successful process exit, or another operation's completion.
// Composed graphs can keep scenario cells at the graph root and express their
// caller through a return edge. That declared edge is a containment boundary
// for observation; a shared or malformed return does not identify one caller.
export function scenarioCaller(graph, scenario) {
  if (scenario?.altitude !== 'scenario') return null;
  const returns = graph.edges.filter(edge => edge.kind === 'return' && edge.from.cellId === scenario.cellId);
  if (returns.length !== 1 || returns[0].from.portId !== scenario.ports?.outcome?.portId) return null;
  const edge = returns[0];
  return graph.cells.find(cell => cell.cellId === edge.to.cellId && cell.authorityId === 'operation:invoke-scenario' &&
    edge.to.portId === cell.ports?.outcome?.portId) ?? null;
}
export function executionCursors(deck, run) {
  if (!run?.graph || run.ambiguous || !deck.observationMap ||
      run.graph.graphId !== `graph:${deck.capabilityId}` || deck.snapshotDigest !== deck.observationMap.snapshotDigest) return [];
  const cells = new Map(run.graph.cells.map(cell => [cell.cellId, cell]));
  const edges = new Map(run.graph.edges.map(edge => [edge.edgeId, edge]));
  const sources = new Map(), cursors = [], lifecycle = new Map();
  for (const event of run.events) {
    const fact = event.record.payload ?? {};
    const cellReceipt = fact.testimonyType === 'cell-execution-testimony.v1';
    const edgeReceipt = fact.testimonyType === 'edge-execution-testimony.v1';
    if (!cellReceipt && !edgeReceipt) continue;
    let cell = cells.get(cellReceipt ? fact.cellId : fact.destinationCellId);
    // Nested invocations can publish cells outside this captured graph. They
    // cannot move this circuit's cursor, nor erase its outstanding call.
    if (!cell || cell.semanticAddress !== fact.semanticAddress || (cellReceipt && cell.altitude !== fact.cellAltitude)) continue;
    if (cellReceipt) {
      const ids = sources.get(fact.cellExecutionId) ?? new Set();
      ids.add(cell.cellId); sources.set(fact.cellExecutionId, ids);
    }
    if (edgeReceipt && !deck.observationMap.flowPolicy.admittedDispositions.includes(fact.admissionDisposition)) continue;
    const edge = edgeReceipt ? edges.get(fact.edgeId) : null;
    if (edgeReceipt) {
      if (!edge || edge.to.cellId !== cell.cellId || !cells.has(edge.from.cellId)) continue;
      const source = sources.get(fact.sourceCellExecutionId);
      if (source && !source.has(edge.from.cellId)) continue;
    }
    const ownCell = cell;
    const visited = new Set();
    while (cell && !visited.has(cell.cellId)) {
      visited.add(cell.cellId);
      const bindings = deck.observationMap.bindings.filter(binding => binding.semanticAddress === cell.semanticAddress && binding.altitude === cell.altitude);
      const nodes = bindings.map(binding => deck.nodes.find(node => node.id === binding.nodeId)).filter(Boolean);
      const operation = nodes.find(node => node.kind === 'operation');
      const boundary = (deck.observationMap.boundaries ?? []).find(boundary => boundary.semanticAddress === cell.semanticAddress);
      if (operation || boundary) {
        const scenarioId = operation?.scenarioIds?.[0] ?? boundary?.scenarioId;
        const owner = (deck.observationMap.boundaries ?? []).find(boundary => boundary.scenarioId === scenarioId);
        const returned = cellReceipt && ownCell === cell && cell.altitude === 'scenario';
        const variant = returned && owner && fact.outcomeContractId === owner.outcomeContractId &&
          ownCell.ports?.outcome?.contractId === owner.outcomeContractId ? (owner.variants ?? []).find(variant =>
            variant.variantId === fact.outcomeVariant && ownCell.ports.outcome.variants?.includes(variant.variantId)) : null;
        const stage = returned ? 'outcome' : ownCell !== cell || edge?.kind === 'return' ? 'activity' : edgeReceipt ? 'admission' : 'completion';
        // Descendants establish activity, never a new invocation or a return.
        // Keep the original admission stable while that invocation is pending.
        if (stage === 'activity' && lifecycle.has(cell.cellId)) break;
        lifecycle.set(cell.cellId, stage);
        cursors.push({ key: event.record.observationKey, sequence: event.record.seq, at: event.at, fact, cell, edge,
          operationId: operation?.id, eventId: owner?.eventNodeId,
          nodeId: variant?.nodeId ?? operation?.id ?? owner?.eventNodeId,
          providerId: operation && cellReceipt && ownCell === cell && fact.providerProfileId ? deck.observationMap.flowPolicy.providerIdentityPrefix + fact.providerProfileId : null,
          stage,
          label: returned ? `Outcome: ${fact.outcomeVariant ?? 'unreported'}` : operation?.label ?? scenarioId,
          // Receipt metadata only; never used as the live presentation clock.
          milliseconds: run.ended ? 0 : Math.max(0, Number(fact.durationMilliseconds) || 0) });
        break;
      }
      cell = cell.parentCellId == null ? scenarioCaller(run.graph, cell) : cells.get(cell.parentCellId);
    }
  }
  return cursors;
}

export const executionCursor = (deck, run) => executionCursors(deck, run).at(-1) ?? null;
