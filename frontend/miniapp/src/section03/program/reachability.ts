import { SECTION03_NODE_IDS, type Section03NodeId } from './ids';

export const SECTION03_FORWARD_TARGETS = Object.freeze({
  'S03-N01': ['S03-M01', 'S03-E01', 'S03-D01', 'S03-AW01', 'S03-C00', 'S03-NOT01', 'S03-R01'],
  'S03-M01': ['S03-M02'], 'S03-M02': ['S03-M03O', 'S03-M03C', 'S03-D10'], 'S03-M03O': ['S03-D12', 'S03-M01'],
  'S03-M03C': ['S03-M04C'], 'S03-M04C': ['S03-M01'],
  'S03-D01': ['S03-M02', 'S03-D10'], 'S03-D10': ['S03-D11', 'S03-D12'], 'S03-D11': ['S03-M03O', 'S03-D12'],
  'S03-D12': ['S03-D13'], 'S03-D13': ['S03-N01'],
  'S03-E01': ['S03-E02'], 'S03-E02': ['S03-E12', 'S03-E10', 'S03-E20', 'S03-SAL01'],
  'S03-E10': ['S03-E11'], 'S03-E11': ['S03-E01'], 'S03-E12': ['S03-E13', 'S03-E16', 'S03-E17', 'S03-E10'],
  'S03-E13': ['S03-E14'], 'S03-E14': ['S03-E12', 'S03-E10'], 'S03-E16': ['S03-E12', 'S03-E10'],
  'S03-E17': ['S03-E12', 'S03-E10'], 'S03-E20': ['S03-E21'], 'S03-E21': ['S03-E22'], 'S03-E22': ['S03-CP13', 'S03-CF24'],
  'S03-AW01': ['S03-AW10', 'S03-AW20', 'S03-AW30', 'S03-AW40', 'S03-AW50'],
  'S03-AW10': ['S03-AW11', 'S03-AW12'], 'S03-AW11': ['S03-AW01'], 'S03-AW12': ['S03-AW01'],
  'S03-AW20': ['S03-AW21'], 'S03-AW21': ['S03-AW01'], 'S03-AW30': ['S03-AW31'], 'S03-AW31': ['S03-AW01'],
  'S03-AW40': ['S03-AW41'], 'S03-AW41': ['S03-AW42'], 'S03-AW42': ['S03-AW01'],
  'S03-AW50': ['S03-AW51', 'S03-AW53'], 'S03-AW51': ['S03-AW52'], 'S03-AW52': ['S03-AW01'],
  'S03-AW53': ['S03-AW54'], 'S03-AW54': ['S03-AW01'], 'S03-SAL01': ['S03-SAL02'], 'S03-SAL02': [],
  'S03-C00': ['S03-CF01', 'S03-CP00'], 'S03-CF01': ['S03-CF10', 'S03-CF20'], 'S03-CF10': ['S03-CF11'],
  'S03-CF11': ['S03-CF12'], 'S03-CF12': ['S03-CF13'], 'S03-CF13': ['S03-CF14'], 'S03-CF14': ['S03-C00'],
  'S03-CF20': ['S03-CF21'], 'S03-CF21': ['S03-CF22'], 'S03-CF22': ['S03-CF23'], 'S03-CF23': ['S03-CF24'],
  'S03-CF24': ['S03-CF25'], 'S03-CF25': ['S03-C00'], 'S03-CP00': ['S03-CP10', 'S03-CP20'],
  'S03-CP10': ['S03-CP11'], 'S03-CP11': ['S03-CP12'], 'S03-CP12': ['S03-CP13'], 'S03-CP13': ['S03-CP14'],
  'S03-CP14': ['S03-CP15'], 'S03-CP15': ['S03-CP16'], 'S03-CP16': ['S03-C00'], 'S03-CP20': ['S03-CP11'],
  'S03-NOT01': ['S03-AW10', 'S03-AW50', 'S03-M02'],
  'S03-R01': ['S03-R10'], 'S03-R10': ['S03-R11', 'S03-R13'], 'S03-R11': ['S03-R12'],
  'S03-R12': ['S03-R13'], 'S03-R13': ['S03-R14'], 'S03-R14': ['S03-N01'],
} satisfies Readonly<Record<Section03NodeId, readonly Section03NodeId[]>>);

export function reachableSection03Nodes(): ReadonlySet<Section03NodeId> {
  const reached = new Set<Section03NodeId>();
  const pending: Section03NodeId[] = ['S03-N01'];
  while (pending.length > 0) {
    const nodeId = pending.shift();
    if (nodeId === undefined || reached.has(nodeId)) continue;
    reached.add(nodeId);
    pending.push(...SECTION03_FORWARD_TARGETS[nodeId]);
  }
  return reached;
}

export function assertSection03Reachability(): void {
  const reached = reachableSection03Nodes();
  const missing = SECTION03_NODE_IDS.filter((nodeId) => !reached.has(nodeId));
  if (missing.length > 0) throw new Error(`Unreachable Section 03 nodes: ${missing.join(', ')}`);
}
