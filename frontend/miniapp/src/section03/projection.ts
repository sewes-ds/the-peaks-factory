import type { Section03NodeId } from './program';
import type { Section03ScreenProjection } from './presentation';
import type { P1NodeInput } from './projections/common';
import {
  SECTION03_P1_SPECIALIZED_NODE_IDS,
  projectSection03P1,
  type Section03P1SpecializedNodeId,
} from './projections/p1';
import {
  SECTION03_P2A1_SPECIALIZED_NODE_IDS,
  projectSection03P2A1,
  type Section03P2A1SpecializedNodeId,
} from './projections/p2a1Employees';
import {
  SECTION03_P2A2A_SPECIALIZED_NODE_IDS,
  projectSection03P2A2a,
  type Section03P2A2aSpecializedNodeId,
} from './projections/p2a2aShiftClose';
import {
  SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
  projectSection03P2A2b,
  type Section03P2A2bSpecializedNodeId,
} from './projections/p2a2bBlockers';
import {
  SECTION03_P2B1_SPECIALIZED_NODE_IDS,
  projectSection03P2B1,
  type Section03P2B1SpecializedNodeId,
} from './projections/p2b1CompletedWorks';
import {
  SECTION03_P2B2_SPECIALIZED_NODE_IDS,
  projectSection03P2B2,
  type Section03P2B2SpecializedNodeId,
} from './projections/p2b2Salary';
import {
  SECTION03_P3A1_SPECIALIZED_NODE_IDS,
  projectSection03P3A1,
  type Section03P3A1SpecializedNodeId,
} from './projections/p3a1AdditionalWorkRequests';
import {
  SECTION03_P3A2_SPECIALIZED_NODE_IDS,
  projectSection03P3A2,
  type Section03P3A2SpecializedNodeId,
} from './projections/p3a2AdditionalWorkLifecycle';
import {
  SECTION03_P3A3_SPECIALIZED_NODE_IDS,
  projectSection03P3A3,
  type Section03P3A3SpecializedNodeId,
} from './projections/p3a3AssignAdditionalWork';
import {
  SECTION03_P3A4_SPECIALIZED_NODE_IDS,
  projectSection03P3A4,
  type Section03P3A4SpecializedNodeId,
} from './projections/p3a4AdditionalWorkAccrual';
import {
  SECTION03_P4A1_SPECIALIZED_NODE_IDS,
  projectSection03P4A1,
  type Section03P4A1SpecializedNodeId,
} from './projections/p4a1CorrectionsEntry';
import {
  SECTION03_P4A2_SPECIALIZED_NODE_IDS,
  projectSection03P4A2,
  type Section03P4A2SpecializedNodeId,
} from './projections/p4a2FinancialCorrectionCreate';
import {
  SECTION03_P4A3_SPECIALIZED_NODE_IDS,
  projectSection03P4A3,
  type Section03P4A3SpecializedNodeId,
} from './projections/p4a3FinancialCorrectionReversal';
import {
  SECTION03_P4A4_SPECIALIZED_NODE_IDS,
  projectSection03P4A4,
  type Section03P4A4SpecializedNodeId,
} from './projections/p4a4ProductionCorrection';
import {
  SECTION03_P4A5_SPECIALIZED_NODE_IDS,
  projectSection03P4A5,
  type Section03P4A5SpecializedNodeId,
} from './projections/p4a5Notifications';
import {
  SECTION03_P5_SPECIALIZED_NODE_IDS,
  projectSection03P5,
  type Section03P5SpecializedNodeId,
} from './projections/p5Reports';

export type CreateSection03ScreenProjectionInput = {
  [N in Section03NodeId]: P1NodeInput<N>;
}[Section03NodeId];

const specialized = new Set<Section03NodeId>(
  SECTION03_P1_SPECIALIZED_NODE_IDS,
);
const p2a1Specialized = new Set<Section03NodeId>(
  SECTION03_P2A1_SPECIALIZED_NODE_IDS,
);
const p2a2aSpecialized = new Set<Section03NodeId>(
  SECTION03_P2A2A_SPECIALIZED_NODE_IDS,
);
const p2a2bSpecialized = new Set<Section03NodeId>(
  SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
);
const p2b1Specialized = new Set<Section03NodeId>(
  SECTION03_P2B1_SPECIALIZED_NODE_IDS,
);
const p2b2Specialized = new Set<Section03NodeId>(
  SECTION03_P2B2_SPECIALIZED_NODE_IDS,
);
const p3a1Specialized = new Set<Section03NodeId>(
  SECTION03_P3A1_SPECIALIZED_NODE_IDS,
);
const p3a2Specialized = new Set<Section03NodeId>(
  SECTION03_P3A2_SPECIALIZED_NODE_IDS,
);
const p3a3Specialized = new Set<Section03NodeId>(
  SECTION03_P3A3_SPECIALIZED_NODE_IDS,
);
const p3a4Specialized = new Set<Section03NodeId>(
  SECTION03_P3A4_SPECIALIZED_NODE_IDS,
);
const p4a1Specialized = new Set<Section03NodeId>(
  SECTION03_P4A1_SPECIALIZED_NODE_IDS,
);
const p4a2Specialized = new Set<Section03NodeId>(
  SECTION03_P4A2_SPECIALIZED_NODE_IDS,
);
const p4a3Specialized = new Set<Section03NodeId>(
  SECTION03_P4A3_SPECIALIZED_NODE_IDS,
);
const p4a4Specialized = new Set<Section03NodeId>(
  SECTION03_P4A4_SPECIALIZED_NODE_IDS,
);
const p4a5Specialized = new Set<Section03NodeId>(
  SECTION03_P4A5_SPECIALIZED_NODE_IDS,
);
const p5Specialized = new Set<Section03NodeId>(
  SECTION03_P5_SPECIALIZED_NODE_IDS,
);

export function createSection03ScreenProjection(
  input: CreateSection03ScreenProjectionInput,
): Section03ScreenProjection {
  if (specialized.has(input.nodeId)) {
    return projectSection03P1(
      input as P1NodeInput<Section03P1SpecializedNodeId>,
    );
  }
  if (p2a1Specialized.has(input.nodeId)) {
    return projectSection03P2A1(
      input as P1NodeInput<Section03P2A1SpecializedNodeId>,
    );
  }
  if (p2a2aSpecialized.has(input.nodeId)) {
    return projectSection03P2A2a(
      input as P1NodeInput<Section03P2A2aSpecializedNodeId>,
    );
  }
  if (p2a2bSpecialized.has(input.nodeId)) {
    return projectSection03P2A2b(
      input as P1NodeInput<Section03P2A2bSpecializedNodeId>,
    );
  }
  if (p2b1Specialized.has(input.nodeId)) {
    return projectSection03P2B1(
      input as P1NodeInput<Section03P2B1SpecializedNodeId>,
    );
  }
  if (p2b2Specialized.has(input.nodeId)) {
    return projectSection03P2B2(
      input as P1NodeInput<Section03P2B2SpecializedNodeId>,
    );
  }
  if (p3a1Specialized.has(input.nodeId)) {
    return projectSection03P3A1(
      input as P1NodeInput<Section03P3A1SpecializedNodeId>,
    );
  }
  if (p3a2Specialized.has(input.nodeId)) {
    return projectSection03P3A2(
      input as P1NodeInput<Section03P3A2SpecializedNodeId>,
    );
  }
  if (p3a3Specialized.has(input.nodeId)) {
    return projectSection03P3A3(
      input as P1NodeInput<Section03P3A3SpecializedNodeId>,
    );
  }
  if (p3a4Specialized.has(input.nodeId)) {
    return projectSection03P3A4(
      input as P1NodeInput<Section03P3A4SpecializedNodeId>,
    );
  }
  if (p4a1Specialized.has(input.nodeId)) {
    return projectSection03P4A1(
      input as P1NodeInput<Section03P4A1SpecializedNodeId>,
    );
  }
  if (p4a2Specialized.has(input.nodeId)) {
    return projectSection03P4A2(
      input as P1NodeInput<Section03P4A2SpecializedNodeId>,
    );
  }
  if (p4a3Specialized.has(input.nodeId)) {
    return projectSection03P4A3(
      input as P1NodeInput<Section03P4A3SpecializedNodeId>,
    );
  }
  if (p4a4Specialized.has(input.nodeId)) {
    return projectSection03P4A4(
      input as P1NodeInput<Section03P4A4SpecializedNodeId>,
    );
  }
  if (p4a5Specialized.has(input.nodeId)) {
    return projectSection03P4A5(
      input as P1NodeInput<Section03P4A5SpecializedNodeId>,
    );
  }
  if (p5Specialized.has(input.nodeId)) {
    return projectSection03P5(
      input as P1NodeInput<Section03P5SpecializedNodeId>,
    );
  }
  throw new Error(`Unknown Section 03 projection node ${input.nodeId}.`);
}

export { SECTION03_P1_SPECIALIZED_NODE_IDS } from './projections/p1';
export {
  SECTION03_P2A1_SPECIALIZED_NODE_IDS,
} from './projections/p2a1Employees';
export {
  SECTION03_P2A2A_SPECIALIZED_NODE_IDS,
} from './projections/p2a2aShiftClose';
export {
  SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
} from './projections/p2a2bBlockers';
export {
  SECTION03_P2B1_SPECIALIZED_NODE_IDS,
} from './projections/p2b1CompletedWorks';
export {
  SECTION03_P2B2_SPECIALIZED_NODE_IDS,
} from './projections/p2b2Salary';
export {
  SECTION03_P3A1_SPECIALIZED_NODE_IDS,
} from './projections/p3a1AdditionalWorkRequests';
export {
  SECTION03_P3A2_SPECIALIZED_NODE_IDS,
} from './projections/p3a2AdditionalWorkLifecycle';
export {
  SECTION03_P3A3_SPECIALIZED_NODE_IDS,
} from './projections/p3a3AssignAdditionalWork';
export {
  SECTION03_P3A4_SPECIALIZED_NODE_IDS,
} from './projections/p3a4AdditionalWorkAccrual';
export {
  SECTION03_P4A1_SPECIALIZED_NODE_IDS,
} from './projections/p4a1CorrectionsEntry';
export {
  SECTION03_P4A2_SPECIALIZED_NODE_IDS,
} from './projections/p4a2FinancialCorrectionCreate';
export {
  SECTION03_P4A3_SPECIALIZED_NODE_IDS,
} from './projections/p4a3FinancialCorrectionReversal';
export {
  SECTION03_P4A4_SPECIALIZED_NODE_IDS,
} from './projections/p4a4ProductionCorrection';
export {
  SECTION03_P4A5_SPECIALIZED_NODE_IDS,
} from './projections/p4a5Notifications';
export {
  SECTION03_P5_SPECIALIZED_NODE_IDS,
} from './projections/p5Reports';
