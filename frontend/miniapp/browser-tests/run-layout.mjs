import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const browserTests = dirname(fileURLToPath(import.meta.url));
const miniapp = resolve(browserTests, '..');
const cardContentLinesOnly = process.env.PRESENTATION_CARD_CONTENT_LINES_ONLY === '1';
const p2a1FocusedOnly = process.env.SECTION03_P2A1_FOCUSED_ONLY === '1';
const p2a2aFocusedOnly = process.env.SECTION03_P2A2A_FOCUSED_ONLY === '1';
const p2a2bFocusedOnly = process.env.SECTION03_P2A2B_FOCUSED_ONLY === '1';
const p2b1FocusedOnly = process.env.SECTION03_P2B1_FOCUSED_ONLY === '1';
const p2b2FocusedOnly = process.env.SECTION03_P2B2_FOCUSED_ONLY === '1';
const p3a1FocusedOnly = process.env.SECTION03_P3A1_FOCUSED_ONLY === '1';
const p3a2FocusedOnly = process.env.SECTION03_P3A2_FOCUSED_ONLY === '1';
const p3a3FocusedOnly = process.env.SECTION03_P3A3_FOCUSED_ONLY === '1';
const p3a4FocusedOnly = process.env.SECTION03_P3A4_FOCUSED_ONLY === '1';
const p4a1FocusedOnly = process.env.SECTION03_P4A1_FOCUSED_ONLY === '1';
const p4a2FocusedOnly = process.env.SECTION03_P4A2_FOCUSED_ONLY === '1';
const p4a3FocusedOnly = process.env.SECTION03_P4A3_FOCUSED_ONLY === '1';
const p4a4FocusedOnly = process.env.SECTION03_P4A4_FOCUSED_ONLY === '1';
const p4a5FocusedOnly = process.env.SECTION03_P4A5_FOCUSED_ONLY === '1';
const p5FocusedOnly = process.env.SECTION03_P5_FOCUSED_ONLY === '1';
const correctiveDomWidth = Number.parseInt(process.env.SECTION03_CORRECTIVE_DOM_WIDTH ?? '390', 10);
const correctiveDomHeight = Number.parseInt(process.env.SECTION03_CORRECTIVE_DOM_HEIGHT ?? (correctiveDomWidth >= 1000 ? '900' : '844'), 10);
if (!Number.isSafeInteger(correctiveDomWidth) || !Number.isSafeInteger(correctiveDomHeight) || correctiveDomWidth < 320 || correctiveDomHeight < 600) {
  throw new Error('SECTION03 corrective DOM viewport is invalid.');
}
const correctiveDomViewport = Object.freeze({
  width: correctiveDomWidth,
  height: correctiveDomHeight,
  deviceScaleFactor: 1,
  mobile: correctiveDomWidth < 600,
});
const p4a5OrLaterFocused = p4a5FocusedOnly || p5FocusedOnly;
const p4a4OrLaterFocused = p4a4FocusedOnly || p4a5OrLaterFocused;
const p4a3OrLaterFocused = p4a3FocusedOnly || p4a4OrLaterFocused;
const p4a2OrLaterFocused = p4a2FocusedOnly || p4a3OrLaterFocused;
const focusedOnly = p2a1FocusedOnly || p2a2aFocusedOnly || p2a2bFocusedOnly || p2b1FocusedOnly || p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused;
const nodeSource = readFileSync(join(browserTests, 'nodeRegistry.ts'), 'utf8');
const nodeBlock = nodeSource.match(/SECTION03_BROWSER_NODE_IDS[\s\S]*?as const/)?.[0] ?? '';
const nodes = [...nodeBlock.matchAll(/'(S03-[A-Z0-9]+)'/g)].map((match) => match[1]);
const highRiskBlock = nodeSource.match(/SECTION03_HIGH_RISK_BROWSER_NODE_INDEXES[\s\S]*?as const/)?.[0] ?? '';
const highRisk = new Set([...highRiskBlock.matchAll(/\b(\d+)\b/g)].map((match) => nodes[Number(match[1])]).filter(Boolean));
const scenarioSource = readFileSync(join(browserTests, 'scenarioRegistry.ts'), 'utf8');
const scenarioBlock = scenarioSource.match(/SECTION03_BROWSER_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const scenarios = [...scenarioBlock.matchAll(/'([a-z][a-z-]+)'/g)].map((match) => match[1]);
const registeredExecutableNodes = new Set([...scenarioSource.matchAll(/'(S03-[A-Z0-9]+)'/g)].map((match) => match[1]));
const p1DomScenarioSource = readFileSync(join(browserTests, 'p1DomScenarioRegistry.ts'), 'utf8');
const p1DomScenarioBlock = p1DomScenarioSource.match(/SECTION03_P1_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p1DomScenarios = [...p1DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p1FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p1.ts'), 'utf8');
const p1Fixtures = [...p1FixtureSource.matchAll(/fixtureId: '(S03-[A-Z0-9]+:[a-zA-Z0-9-]+)'/g)]
  .map((match) => ({ fixtureId: match[1], nodeId: match[1].split(':')[0] }));
const p2a1DomScenarioSource = readFileSync(join(browserTests, 'p2a1DomScenarioRegistry.ts'), 'utf8');
const p2a1DomScenarioBlock = p2a1DomScenarioSource.match(/SECTION03_P2A1_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p2a1DomScenarios = [...p2a1DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p2a1FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p2a1Employees.ts'), 'utf8');
const p2a1FixtureIds = [...new Set([...p2a1FixtureSource.matchAll(/'(S03-E(?:01|02|12):[a-z0-9-]+)'/g)]
  .map((match) => match[1]))];
const p2a1Fixtures = p2a1FixtureIds.map((fixtureId) => ({ fixtureId, nodeId: fixtureId.split(':')[0] }));
const p2a2aDomScenarioSource = readFileSync(join(browserTests, 'p2a2aDomScenarioRegistry.ts'), 'utf8');
const p2a2aDomScenarioBlock = p2a2aDomScenarioSource.match(/SECTION03_P2A2A_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p2a2aDomScenarios = [...p2a2aDomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p2a2aFixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p2a2aShiftClose.ts'), 'utf8');
const p2a2aFixtures = [...p2a2aFixtureSource.matchAll(/fixtureId: '(S03-E(?:10|11):[a-z0-9-]+)'/g)]
  .map((match) => ({ fixtureId: match[1], nodeId: match[1].split(':')[0] }));
const p2a2bDomScenarioSource = readFileSync(join(browserTests, 'p2a2bDomScenarioRegistry.ts'), 'utf8');
const p2a2bDomScenarioBlock = p2a2bDomScenarioSource.match(/SECTION03_P2A2B_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p2a2bDomScenarios = [...p2a2bDomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p2a2bFixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p2a2bBlockers.ts'), 'utf8');
const p2a2bFixtures = [...p2a2bFixtureSource.matchAll(/fixtureId: '(S03-E(?:13|14|16|17):[a-z0-9-]+)'/g)]
  .map((match) => ({ fixtureId: match[1], nodeId: match[1].split(':')[0] }));
const p2b1DomScenarioSource = readFileSync(join(browserTests, 'p2b1DomScenarioRegistry.ts'), 'utf8');
const p2b1DomScenarioBlock = p2b1DomScenarioSource.match(/SECTION03_P2B1_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p2b1DomScenarios = [...p2b1DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p2b1FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p2b1CompletedWorks.ts'), 'utf8');
const p2b1FixtureIds = [...p2b1FixtureSource.matchAll(/fixtureId: '(S03-E(?:20|21|22):[a-z0-9-]+)'/g)]
  .map((match) => match[1]);
const p2b1Fixtures = p2b1FixtureIds
  .filter((fixtureId) => !fixtureId.endsWith('employee-mismatch') && !fixtureId.endsWith('work-type-mismatch') && !fixtureId.endsWith('operation-id-mismatch'))
  .map((fixtureId) => ({ fixtureId, nodeId: fixtureId.split(':')[0] }));
const p2b2DomScenarioSource = readFileSync(join(browserTests, 'p2b2DomScenarioRegistry.ts'), 'utf8');
const p2b2DomScenarioBlock = p2b2DomScenarioSource.match(/SECTION03_P2B2_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p2b2DomScenarios = [...p2b2DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p2b2FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p2b2Salary.ts'), 'utf8');
const p2b2FixtureIds = [...p2b2FixtureSource.matchAll(/fixtureId: '(S03-SAL0[12]:[a-z0-9-]+)'/g)]
  .map((match) => match[1]);
const p2b2Fixtures = p2b2FixtureIds
  .filter((fixtureId) => !fixtureId.endsWith('id-mismatch'))
  .map((fixtureId) => ({ fixtureId, nodeId: fixtureId.split(':')[0] }));
const p3a1DomScenarioSource = readFileSync(join(browserTests, 'p3a1DomScenarioRegistry.ts'), 'utf8');
const p3a1DomScenarioBlock = p3a1DomScenarioSource.match(/SECTION03_P3A1_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p3a1DomScenarios = [...p3a1DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p3a1FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p3a1AdditionalWorkRequests.ts'), 'utf8');
const p3a1FixtureIds = [...p3a1FixtureSource.matchAll(/fixtureId: '(S03-AW(?:01|10|11|12):[a-z0-9-]+)'/g)]
  .map((match) => match[1]);
const p3a1Fixtures = p3a1FixtureIds
  .filter((fixtureId) => !fixtureId.endsWith('missing-selected-id') && !fixtureId.endsWith('wrong-status'))
  .map((fixtureId) => ({ fixtureId, nodeId: fixtureId.split(':')[0] }));
const p3a2DomScenarioSource = readFileSync(join(browserTests, 'p3a2DomScenarioRegistry.ts'), 'utf8');
const p3a2DomScenarioBlock = p3a2DomScenarioSource.match(/SECTION03_P3A2_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p3a2DomScenarios = [...p3a2DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p3a2FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p3a2AdditionalWorkLifecycle.ts'), 'utf8');
const p3a2FixtureIds = [...p3a2FixtureSource.matchAll(/fixtureId: '(S03-AW(?:20|21|30|31):[a-z0-9-]+)'/g)]
  .map((match) => match[1]);
const p3a2Fixtures = p3a2FixtureIds
  .filter((fixtureId) => !fixtureId.endsWith('missing-selected-id') && !fixtureId.endsWith('wrong-status'))
  .map((fixtureId) => ({ fixtureId, nodeId: fixtureId.split(':')[0] }));
const p3a3DomScenarioSource = readFileSync(join(browserTests, 'p3a3DomScenarioRegistry.ts'), 'utf8');
const p3a3DomScenarioBlock = p3a3DomScenarioSource.match(/SECTION03_P3A3_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p3a3DomScenarios = [...p3a3DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p3a3FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p3a3AssignAdditionalWork.ts'), 'utf8');
const p3a3FixtureIds = [...p3a3FixtureSource.matchAll(/fixtureId: '(S03-AW(?:40|41|42):[a-z0-9-]+)'/g)]
  .map((match) => match[1]);
const p3a3Fixtures = p3a3FixtureIds
  .filter((fixtureId) => !fixtureId.endsWith('missing-employee-name') && !fixtureId.endsWith('missing-type-name'))
  .map((fixtureId) => ({ fixtureId, nodeId: fixtureId.split(':')[0] }));
const p3a4DomScenarioSource = readFileSync(join(browserTests, 'p3a4DomScenarioRegistry.ts'), 'utf8');
const p3a4DomScenarioBlock = p3a4DomScenarioSource.match(/SECTION03_P3A4_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p3a4DomScenarios = [...p3a4DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p3a4FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p3a4AdditionalWorkAccrual.ts'), 'utf8');
const p3a4FixtureIds = [...p3a4FixtureSource.matchAll(/fixtureId: '(S03-AW(?:50|51|52|53|54):[a-z0-9-]+)'/g)]
  .map((match) => match[1]);
const p3a4Fixtures = p3a4FixtureIds
  .filter((fixtureId) => !fixtureId.endsWith('missing-selected-id') && !fixtureId.endsWith('wrong-status'))
  .map((fixtureId) => ({ fixtureId, nodeId: fixtureId.split(':')[0] }));
const p4a1DomScenarioSource = readFileSync(join(browserTests, 'p4a1DomScenarioRegistry.ts'), 'utf8');
const p4a1DomScenarioBlock = p4a1DomScenarioSource.match(/SECTION03_P4A1_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p4a1DomScenarios = [...p4a1DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p4a1FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p4a1CorrectionsEntry.ts'), 'utf8');
const p4a1FixtureIds = [...p4a1FixtureSource.matchAll(/fixtureId: '(S03-C(?:00|F(?:01|10|11)):[a-z0-9-]+)'/g)]
  .map((match) => match[1]);
const p4a1Fixtures = p4a1FixtureIds
  .filter((fixtureId) => !fixtureId.endsWith('missing-employee') && !fixtureId.endsWith('shift-id-mismatch'))
  .map((fixtureId) => ({ fixtureId, nodeId: fixtureId.split(':')[0] }));
const p4a2DomScenarioSource = readFileSync(join(browserTests, 'p4a2DomScenarioRegistry.ts'), 'utf8');
const p4a2DomScenarioBlock = p4a2DomScenarioSource.match(/SECTION03_P4A2_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p4a2DomScenarios = [...p4a2DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p4a2FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p4a2FinancialCorrectionCreate.ts'), 'utf8');
const p4a2FixtureEntries = [...p4a2FixtureSource.matchAll(/fixtureId: '(S03-CF1[234]:[a-z0-9-]+)'[^\n]*expectProjectionFailure: (true|false)/g)]
  .map((match) => ({ fixtureId: match[1], nodeId: match[1].split(':')[0], renderable: match[2] === 'false' }));
const p4a2Fixtures = p4a2FixtureEntries.filter((fixture) => fixture.renderable);
const p4a3DomScenarioSource = readFileSync(join(browserTests, 'p4a3DomScenarioRegistry.ts'), 'utf8');
const p4a3DomScenarioBlock = p4a3DomScenarioSource.match(/SECTION03_P4A3_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p4a3DomScenarios = [...p4a3DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p4a3FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p4a3FinancialCorrectionReversal.ts'), 'utf8');
const p4a3FixtureIdBlock = p4a3FixtureSource.match(/SECTION03_P4A3_FIXTURE_IDS[\s\S]*?as const/)?.[0] ?? '';
const p4a3FixtureIds = [...p4a3FixtureIdBlock.matchAll(/'(S03-CF2[0-5]:[a-z0-9-]+)'/g)].map((match) => match[1]);
const p4a3FailClosedSuffixes = new Set([
  'CF22:employee-mismatch', 'CF22:work-employee-mismatch',
  'CF23:employee-mismatch', 'CF23:type-mismatch', 'CF23:operation-mismatch',
  'CF25:employee-mismatch', 'CF25:work-employee-mismatch', 'CF25:type-mismatch',
  'CF25:operation-mismatch', 'CF25:salary-entry-mismatch', 'CF25:missing-salary-entry',
  'CF25:not-reversible', 'CF25:already-reversed', 'CF25:empty-reason',
  'CF25:missing-authority', 'CF25:unrelated-nested-authority',
]);
const p4a3Fixtures = p4a3FixtureIds
  .filter((fixtureId) => ![...p4a3FailClosedSuffixes].some((suffix) => fixtureId.endsWith(suffix)))
  .map((fixtureId) => ({ fixtureId, nodeId: fixtureId.split(':')[0] }));
const p4a4DomScenarioSource = readFileSync(join(browserTests, 'p4a4DomScenarioRegistry.ts'), 'utf8');
const p4a4DomScenarioBlock = p4a4DomScenarioSource.match(/SECTION03_P4A4_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p4a4DomScenarios = [...p4a4DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p4a4FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p4a4ProductionCorrection.ts'), 'utf8');
const p4a4FixtureIdBlock = p4a4FixtureSource.match(/SECTION03_P4A4_FIXTURE_IDS[\s\S]*?as const/)?.[0] ?? '';
const p4a4FixtureIds = [...p4a4FixtureIdBlock.matchAll(/'(S03-CP(?:00|10|11|12|13|14|15|16|20):[a-z0-9-]+)'/g)].map((match) => match[1]);
const p4a4FailClosedSuffixes = new Set([
  'CP11:both-scopes', 'CP11:no-scope',
  'CP12:employee-identity-mismatch', 'CP12:source-branch-mismatch',
  'CP13:missing-operation', 'CP13:scope-mismatch',
  'CP15:invalid-incoming-quantity',
  'CP16:source-scope-mismatch', 'CP16:missing-operation', 'CP16:identity-mismatch',
  'CP16:missing-production-operation-id', 'CP16:can-correct-false', 'CP16:bad-base',
  'CP16:base-current-mismatch', 'CP16:negative-result', 'CP16:zero-delta',
  'CP16:bad-reason', 'CP16:missing-authority', 'CP16:unrelated-authority',
]);
const p4a4Fixtures = p4a4FixtureIds
  .filter((fixtureId) => ![...p4a4FailClosedSuffixes].some((suffix) => fixtureId.endsWith(suffix)))
  .map((fixtureId) => ({ fixtureId, nodeId: fixtureId.split(':')[0] }));
const p4a5DomScenarioSource = readFileSync(join(browserTests, 'p4a5DomScenarioRegistry.ts'), 'utf8');
const p4a5DomScenarioBlock = p4a5DomScenarioSource.match(/SECTION03_P4A5_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p4a5DomScenarios = [...p4a5DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p4a5FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p4a5Notifications.ts'), 'utf8');
const p4a5FixtureEntries = [...p4a5FixtureSource.matchAll(/(?:valid|invalid)\('(S03-NOT01:[a-z0-9-]+)'/g)]
  .map((match) => ({ fixtureId: match[1], nodeId: 'S03-NOT01', renderable: match[0].startsWith('valid') }));
const p4a5Fixtures = p4a5FixtureEntries.filter((fixture) => fixture.renderable);
const p5DomScenarioSource = readFileSync(join(browserTests, 'p5ReportsDomScenarioRegistry.ts'), 'utf8');
const p5DomScenarioBlock = p5DomScenarioSource.match(/SECTION03_P5_DOM_SCENARIOS[\s\S]*?as const/)?.[0] ?? '';
const p5DomScenarios = [...p5DomScenarioBlock.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1]);
const p5FixtureSource = readFileSync(join(miniapp, 'src/section03/fixtures/p5Reports.ts'), 'utf8');
const p5FixtureIds = [
  ...[...p5FixtureSource.matchAll(/fixtureId: '(S03-R[0-9]+:[a-z0-9-]+)'/g)].map((match) => match[1]),
  ...[...p5FixtureSource.matchAll(/r(10|11|12|13|14)\('([a-z0-9-]+)'/g)].map((match) => `S03-R${match[1]}:${match[2]}`),
];
const p5FailClosedIds = new Set([
  'S03-R12:invalid-incoming-from-date',
  'S03-R13:missing-primary', 'S03-R13:period-only-context', 'S03-R13:missing-one-date',
  'S03-R13:malformed-date', 'S03-R13:reversed-range',
  'S03-R14:missing-id', 'S03-R14:zero', 'S03-R14:malformed-id',
]);
const p5FixtureEntries = p5FixtureIds.map((fixtureId) => ({ fixtureId, nodeId: fixtureId.split(':')[0], renderable: !p5FailClosedIds.has(fixtureId) }));
const p5Fixtures = p5FixtureEntries.filter((fixture) => fixture.renderable);
if (nodes.length !== 70 || new Set(nodes).size !== 70) throw new Error(`browser node registry is ${nodes.length}, expected 70`);
if (scenarios.length !== 19 || new Set(scenarios).size !== 19) throw new Error(`browser scenario registry is ${scenarios.length}, expected 19`);
if (registeredExecutableNodes.size !== 64 || [...registeredExecutableNodes].some((nodeId) => nodeId.startsWith('S03-R'))) {
  throw new Error(`browser active executable scenario node union is ${registeredExecutableNodes.size}, expected 64 with Reports deferred`);
}
if (p1DomScenarios.length !== 8 || new Set(p1DomScenarios).size !== 8) throw new Error(`P1 DOM scenario registry is ${p1DomScenarios.length}, expected 8`);
if (p1Fixtures.length !== 39 || new Set(p1Fixtures.map((fixture) => fixture.fixtureId)).size !== 39) throw new Error(`P1 fixture registry is ${p1Fixtures.length}, expected 39`);
if (p2a1DomScenarios.length !== 3 || new Set(p2a1DomScenarios).size !== 3) throw new Error(`P2A1 DOM scenario registry is ${p2a1DomScenarios.length}, expected 3`);
if (p2a1Fixtures.length !== 18) throw new Error(`P2A1 fixture registry is ${p2a1Fixtures.length}, expected 18`);
if (p2a2aDomScenarios.length !== 3 || new Set(p2a2aDomScenarios).size !== 3) throw new Error(`P2A2a DOM scenario registry is ${p2a2aDomScenarios.length}, expected 3`);
if (p2a2aFixtures.length !== 9 || new Set(p2a2aFixtures.map((fixture) => fixture.fixtureId)).size !== 9) throw new Error(`P2A2a fixture registry is ${p2a2aFixtures.length}, expected 9`);
if (p2a2bDomScenarios.length !== 4 || new Set(p2a2bDomScenarios).size !== 4) throw new Error(`P2A2b DOM scenario registry is ${p2a2bDomScenarios.length}, expected 4`);
if (p2a2bFixtures.length !== 29 || new Set(p2a2bFixtures.map((fixture) => fixture.fixtureId)).size !== 29) throw new Error(`P2A2b fixture registry is ${p2a2bFixtures.length}, expected 29`);
if (p2b1DomScenarios.length !== 3 || new Set(p2b1DomScenarios).size !== 3) throw new Error(`P2B1 DOM scenario registry is ${p2b1DomScenarios.length}, expected 3`);
if (p2b1FixtureIds.length !== 17 || new Set(p2b1FixtureIds).size !== 17) throw new Error(`P2B1 fixture registry is ${p2b1FixtureIds.length}, expected 17`);
if (p2b1Fixtures.length !== 13) throw new Error(`P2B1 valid geometry fixture registry is ${p2b1Fixtures.length}, expected 13`);
if (p2b2DomScenarios.length !== 2 || new Set(p2b2DomScenarios).size !== 2) throw new Error(`P2B2 DOM scenario registry is ${p2b2DomScenarios.length}, expected 2`);
if (p2b2FixtureIds.length !== 14 || new Set(p2b2FixtureIds).size !== 14) throw new Error(`P2B2 fixture registry is ${p2b2FixtureIds.length}, expected 14`);
if (p2b2Fixtures.length !== 10) throw new Error(`P2B2 valid geometry fixture registry is ${p2b2Fixtures.length}, expected 10`);
if (p3a1DomScenarios.length !== 3 || new Set(p3a1DomScenarios).size !== 3) throw new Error(`P3A1 DOM scenario registry is ${p3a1DomScenarios.length}, expected 3`);
if (p3a1FixtureIds.length !== 16 || new Set(p3a1FixtureIds).size !== 16) throw new Error(`P3A1 fixture registry is ${p3a1FixtureIds.length}, expected 16`);
if (p3a1Fixtures.length !== 14) throw new Error(`P3A1 valid geometry fixture registry is ${p3a1Fixtures.length}, expected 14`);
if (p3a2DomScenarios.length !== 3 || new Set(p3a2DomScenarios).size !== 3) throw new Error(`P3A2 DOM scenario registry is ${p3a2DomScenarios.length}, expected 3`);
if (p3a2FixtureIds.length !== 18 || new Set(p3a2FixtureIds).size !== 18) throw new Error(`P3A2 fixture registry is ${p3a2FixtureIds.length}, expected 18`);
if (p3a2Fixtures.length !== 14) throw new Error(`P3A2 valid geometry fixture registry is ${p3a2Fixtures.length}, expected 14`);
if (p3a3DomScenarios.length !== 3 || new Set(p3a3DomScenarios).size !== 3) throw new Error(`P3A3 DOM scenario registry is ${p3a3DomScenarios.length}, expected 3`);
if (p3a3FixtureIds.length !== 14 || new Set(p3a3FixtureIds).size !== 14) throw new Error(`P3A3 fixture registry is ${p3a3FixtureIds.length}, expected 14`);
if (p3a3Fixtures.length !== 12) throw new Error(`P3A3 valid geometry fixture registry is ${p3a3Fixtures.length}, expected 12`);
if (p3a4DomScenarios.length !== 3 || new Set(p3a4DomScenarios).size !== 3) throw new Error(`P3A4 DOM scenario registry is ${p3a4DomScenarios.length}, expected 3`);
if (p3a4FixtureIds.length !== 24 || new Set(p3a4FixtureIds).size !== 24) throw new Error(`P3A4 fixture registry is ${p3a4FixtureIds.length}, expected 24`);
if (p3a4Fixtures.length !== 22) throw new Error(`P3A4 valid geometry fixture registry is ${p3a4Fixtures.length}, expected 22`);
if (p4a1DomScenarios.length !== 3 || new Set(p4a1DomScenarios).size !== 3) throw new Error(`P4A1 DOM scenario registry is ${p4a1DomScenarios.length}, expected 3`);
if (p4a1FixtureIds.length !== 13 || new Set(p4a1FixtureIds).size !== 13) throw new Error(`P4A1 fixture registry is ${p4a1FixtureIds.length}, expected 13`);
if (p4a1Fixtures.length !== 11) throw new Error(`P4A1 valid geometry fixture registry is ${p4a1Fixtures.length}, expected 11`);
if (p4a2DomScenarios.length !== 3 || new Set(p4a2DomScenarios).size !== 3) throw new Error(`P4A2 DOM scenario registry is ${p4a2DomScenarios.length}, expected 3`);
if (p4a2FixtureEntries.length === 0 || new Set(p4a2FixtureEntries.map((fixture) => fixture.fixtureId)).size !== p4a2FixtureEntries.length) throw new Error('P4A2 fixture registry is empty or contains duplicate IDs');
if (p4a3DomScenarios.length !== 3 || new Set(p4a3DomScenarios).size !== 3) throw new Error(`P4A3 DOM scenario registry is ${p4a3DomScenarios.length}, expected 3`);
if (p4a3FixtureIds.length !== 40 || new Set(p4a3FixtureIds).size !== 40) throw new Error(`P4A3 fixture registry is ${p4a3FixtureIds.length}, expected 40 unique fixtures`);
if (p4a3Fixtures.length !== p4a3FixtureIds.length - p4a3FailClosedSuffixes.size) throw new Error('P4A3 renderable fixture registry mismatch');
if (p4a4DomScenarios.length !== 4 || new Set(p4a4DomScenarios).size !== 4) throw new Error(`P4A4 DOM scenario registry is ${p4a4DomScenarios.length}, expected 4`);
if (p4a4FixtureIds.length !== 54 || new Set(p4a4FixtureIds).size !== 54) throw new Error(`P4A4 fixture registry is ${p4a4FixtureIds.length}, expected 54 unique fixtures`);
if (p4a4Fixtures.length !== 35 || p4a4FailClosedSuffixes.size !== 19) throw new Error('P4A4 renderable/fail-closed fixture registry mismatch');
if (p4a5DomScenarios.length !== 3 || new Set(p4a5DomScenarios).size !== 3) throw new Error(`P4A5 DOM scenario registry is ${p4a5DomScenarios.length}, expected 3`);
if (p4a5FixtureEntries.length === 0 || new Set(p4a5FixtureEntries.map((fixture) => fixture.fixtureId)).size !== p4a5FixtureEntries.length) throw new Error('P4A5 fixture registry is empty or contains duplicate IDs');
if (p5DomScenarios.length !== 3 || new Set(p5DomScenarios).size !== 3) throw new Error(`P5 DOM scenario registry is ${p5DomScenarios.length}, expected 3`);
if (p5FixtureEntries.length !== 46 || new Set(p5FixtureIds).size !== 46 || p5Fixtures.length !== 37 || p5FailClosedIds.size !== 9) throw new Error(`P5 fixture registry mismatch: ${p5FixtureEntries.length}/${p5Fixtures.length}/${p5FailClosedIds.size}`);

const candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const executable = candidates.map((candidate) => spawnSync('which', [candidate], { encoding: 'utf8' }).stdout.trim()).find(Boolean);
if (!executable) throw new Error('system browser executable not found');
const browserVersion = spawnSync(executable, ['--version'], { encoding: 'utf8' }).stdout.trim();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const evidenceBase = process.env.PEAKS_BROWSER_EVIDENCE_DIR ?? `${process.cwd()}/.browser-evidence`;
const evidenceRoot = `${evidenceBase}/${stamp}-${cardContentLinesOnly ? 'card-content-lines' : p5FocusedOnly ? 'B15-P5' : p4a5FocusedOnly ? 'B15-P4A5' : p4a4FocusedOnly ? 'B15-P4A4' : p4a3FocusedOnly ? 'B15-P4A3' : p4a2FocusedOnly ? 'B15-P4A2' : p4a1FocusedOnly ? 'B15-P4A1' : p3a4FocusedOnly ? 'B15-P3A4' : p3a3FocusedOnly ? 'B15-P3A3' : p3a2FocusedOnly ? 'B15-P3A2' : p3a1FocusedOnly ? 'B15-P3A1' : p2b2FocusedOnly ? 'B15-P2B2' : p2b1FocusedOnly ? 'B15-P2B1' : p2a2bFocusedOnly ? 'B15-P2A2B' : p2a2aFocusedOnly ? 'B15-P2A2A' : p2a1FocusedOnly ? 'B15-P2A1' : 'B15-P1'}`;
mkdirSync(join(evidenceRoot, 'screenshots'), { recursive: true });
mkdirSync(join(evidenceRoot, 'console'), { recursive: true });

const harnessPort = 41739;
const debuggingPort = 42751;
const harnessDist = mkdtempSync(join(tmpdir(), 'section03-browser-harness-'));
const harnessBuild = spawnSync(join(miniapp, 'node_modules/.bin/vite'), [
  'build', '--config', 'browser-tests/vite.config.ts', '--outDir', harnessDist, '--emptyOutDir',
], { cwd: miniapp, encoding: 'utf8' });
if (harnessBuild.status !== 0) throw new Error(`browser harness build failed\n${harnessBuild.stdout}\n${harnessBuild.stderr}`);
const server = spawn('python3', ['-m', 'http.server', String(harnessPort), '--bind', '127.0.0.1', '--directory', harnessDist], {
  cwd: miniapp,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += String(chunk); });
server.stderr.on('data', (chunk) => { serverOutput += String(chunk); });

const browserProfile = mkdtempSync(join(tmpdir(), 'section03-browser-'));
const browser = spawn(executable, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--disable-background-networking',
  '--disable-component-update', '--disable-sync', '--metrics-recording-only', '--no-first-run',
  '--disable-default-apps', '--disable-extensions', '--disable-component-extensions-with-background-pages',
  `--remote-debugging-port=${debuggingPort}`, '--remote-allow-origins=*',
  `--user-data-dir=${browserProfile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let browserDiagnostics = '';
browser.stderr.on('data', (chunk) => {
  browserDiagnostics += String(chunk);
  if (browserDiagnostics.length > 1024 * 1024) browserDiagnostics = browserDiagnostics.slice(-1024 * 1024);
});

async function waitForHttp(url, description) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`${description} did not start\n${serverOutput}\n${browserDiagnostics}`);
}

function encodeFrame(text, opcode = 1) {
  const payload = Buffer.from(text);
  const mask = randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | payload.length;
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  header[0] = 0x80 | opcode;
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) masked[index] = payload[index] ^ mask[index % 4];
  return Buffer.concat([header, mask, masked]);
}

async function createWebSocketClient(webSocketUrl) {
  const parsed = new URL(webSocketUrl);
  const socket = connect(Number(parsed.port), parsed.hostname);
  await new Promise((resolveConnect, rejectConnect) => {
    socket.once('connect', resolveConnect);
    socket.once('error', rejectConnect);
  });
  const key = randomBytes(16).toString('base64');
  socket.write([
    `GET ${parsed.pathname}${parsed.search} HTTP/1.1`,
    `Host: ${parsed.host}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${key}`,
    'Sec-WebSocket-Version: 13',
    '\r\n',
  ].join('\r\n'));
  let buffer = Buffer.alloc(0);
  await new Promise((resolveHandshake, rejectHandshake) => {
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const boundary = buffer.indexOf('\r\n\r\n');
      if (boundary < 0) return;
      socket.off('data', onData);
      const response = buffer.subarray(0, boundary).toString();
      buffer = buffer.subarray(boundary + 4);
      if (!response.startsWith('HTTP/1.1 101')) rejectHandshake(new Error(`WebSocket upgrade failed: ${response}`));
      else resolveHandshake();
    };
    socket.on('data', onData);
    socket.once('error', rejectHandshake);
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  const eventWaiters = [];
  let fragmented = Buffer.alloc(0);
  let fragmentedOpcode = 0;
  function dispatch(message) {
    if (message.id !== undefined) {
      const waiter = pending.get(message.id);
      if (waiter !== undefined) {
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
        else waiter.resolve(message.result);
      }
      return;
    }
    listeners.forEach((listener) => listener(message));
    const index = eventWaiters.findIndex((waiter) => waiter.method === message.method);
    if (index >= 0) eventWaiters.splice(index, 1)[0].resolve(message.params);
  }
  function parseFrames(chunk = Buffer.alloc(0)) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const final = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let length = buffer[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return;
        length = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }
      const maskOffset = masked ? 4 : 0;
      if (buffer.length < offset + maskOffset + length) return;
      const mask = masked ? buffer.subarray(offset, offset + 4) : null;
      offset += maskOffset;
      const payload = Buffer.from(buffer.subarray(offset, offset + length));
      buffer = buffer.subarray(offset + length);
      if (mask !== null) for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
      if (opcode === 8) return;
      if (opcode === 9) { socket.write(encodeFrame(payload.toString(), 10)); continue; }
      if (opcode === 1 && final) { dispatch(JSON.parse(payload.toString())); continue; }
      if (opcode === 1) { fragmentedOpcode = opcode; fragmented = payload; continue; }
      if (opcode === 0) {
        fragmented = Buffer.concat([fragmented, payload]);
        if (final && fragmentedOpcode === 1) dispatch(JSON.parse(fragmented.toString()));
        if (final) { fragmented = Buffer.alloc(0); fragmentedOpcode = 0; }
      }
    }
  }
  socket.on('data', parseFrames);
  if (buffer.length > 0) parseFrames();
  return Object.freeze({
    command(method, params = {}) {
      const id = nextId++;
      return new Promise((resolveCommand, rejectCommand) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          rejectCommand(new Error(`CDP WebSocket command timed out: ${method}`));
        }, 15000);
        pending.set(id, {
          resolve: (value) => { clearTimeout(timeout); resolveCommand(value); },
          reject: (error) => { clearTimeout(timeout); rejectCommand(error); },
        });
        socket.write(encodeFrame(JSON.stringify({ id, method, params })));
      });
    },
    waitEvent(method) {
      return new Promise((resolveEvent, rejectEvent) => {
        const timeout = setTimeout(() => {
          const index = eventWaiters.findIndex((waiter) => waiter.resolve === resolveEvent);
          if (index >= 0) eventWaiters.splice(index, 1);
          rejectEvent(new Error(`CDP WebSocket event timed out: ${method}`));
        }, 15000);
        eventWaiters.push({ method, resolve: (value) => { clearTimeout(timeout); resolveEvent(value); } });
      });
    },
    onEvent(listener) { listeners.push(listener); },
    close() { socket.end(encodeFrame('', 8)); },
  });
}

try {
  await waitForHttp(`http://127.0.0.1:${harnessPort}/`, 'browser harness server');
  const targetsResponse = await waitForHttp(`http://127.0.0.1:${debuggingPort}/json/list`, 'Chrome debugging endpoint');
  const targets = await targetsResponse.json();
  const target = targets.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
  if (target === undefined) throw new Error('Chrome debugging endpoint has no page target');
  const cdp = await createWebSocketClient(target.webSocketDebuggerUrl);
  const consoleMessages = [];
  const unexpectedExternalRequests = new Set();
  cdp.onEvent((message) => {
    if (message.method === 'Runtime.exceptionThrown') consoleMessages.push(JSON.stringify(message.params));
    if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') consoleMessages.push(JSON.stringify(message.params.entry));
    if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') consoleMessages.push(JSON.stringify(message.params));
    if (message.method === 'Network.requestWillBeSent') {
      const requestedUrl = message.params?.request?.url;
      if (typeof requestedUrl === 'string') {
        try {
          const parsed = new URL(requestedUrl);
          if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname !== '127.0.0.1') {
            unexpectedExternalRequests.add(requestedUrl);
          }
        } catch {}
      }
    }
  });
  await cdp.command('Page.enable');
  await cdp.command('Runtime.enable');
  await cdp.command('Log.enable');
  await cdp.command('Network.enable');
  const viewports = [[360, 800], [390, 844], [412, 915]];
  const results = [];
  const cardContentLineResults = [];
  let missingScreenshots = 0;
  const scenariosOnly = process.env.SECTION03_BROWSER_SCENARIOS_ONLY === '1';
  if (cardContentLinesOnly) for (const [width, height] of viewports) {
    const screenshot = join(evidenceRoot, 'screenshots', `card-content-lines-${width}x${height}.png`);
    const url = `http://127.0.0.1:${harnessPort}/?card-content-lines=1&viewport=${width}x${height}`;
    consoleMessages.length = 0;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let result = null;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#card-content-lines-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          const candidate = JSON.parse(evaluated.result.value);
          if (candidate.viewport?.width === width && candidate.viewport?.height === height) {
            result = candidate;
            break;
          }
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (result === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`card content-line result missing for ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(screenshot, captured.data, 'base64');
    const pageConsoleErrors = [...consoleMessages, ...(result.browser_console_errors ?? [])];
    writeFileSync(join(evidenceRoot, 'console', `card-content-lines-${width}x${height}.log`), pageConsoleErrors.join('\n'));
    cardContentLineResults.push({
      ...result,
      screenshot: screenshot.replace(`${evidenceRoot}/`, ''),
      console_error_count: pageConsoleErrors.length,
    });
    if (!existsSync(screenshot)) missingScreenshots += 1;
  }
  if (!scenariosOnly && !cardContentLinesOnly && !focusedOnly) for (const node of nodes) {
    for (const [width, height] of viewports) {
      const requiredScreenshot = width === 390 || highRisk.has(node);
      const screenshot = requiredScreenshot ? join(evidenceRoot, 'screenshots', `${node}-${width}x${height}.png`) : null;
      const url = `http://127.0.0.1:${harnessPort}/?node=${encodeURIComponent(node)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      await new Promise((resolveWait) => setTimeout(resolveWait, 500));
      let layout = null;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === node) { layout = candidate; break; }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`layout result missing for ${node} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\nbrowser=${browserDiagnostics}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${node}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      results.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      if (results.length % 10 === 0) process.stderr.write(`browser-layout-progress ${results.length}/210\n`);
    }
  }
  const p1GeometryResults = [];
  if (!scenariosOnly && !cardContentLinesOnly) for (const fixture of p1Fixtures) {
    const p1Viewports = focusedOnly ? [[390, 844]] : viewports;
    for (const [width, height] of p1Viewports) {
      const highRiskVariant = fixture.fixtureId.includes('long-content') || fixture.nodeId === 'S03-M03C' || fixture.nodeId === 'S03-D12';
      const requiredScreenshot = width === 390 || highRiskVariant;
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`) : null;
      const url = `http://127.0.0.1:${harnessPort}/?p1-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      await new Promise((resolveWait) => setTimeout(resolveWait, 300));
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) { layout = candidate; break; }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P1 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p1GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      if (p1GeometryResults.length % 12 === 0) process.stderr.write(`p1-fixture-geometry-progress ${p1GeometryResults.length}/${focusedOnly ? 39 : 117}\n`);
    }
  }
  const p2a1GeometryResults = [];
  if (focusedOnly) for (const fixture of p2a1Fixtures) {
    const p2a1Viewports = p2a2aFocusedOnly || p2a2bFocusedOnly || p2b1FocusedOnly || p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p2a1Viewports) {
      const highRiskVariant = fixture.fixtureId.includes('long-content');
      const requiredScreenshot = width === 390 || highRiskVariant;
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p2a1-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P2A1 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p2a1GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      if (p2a1GeometryResults.length % 9 === 0) process.stderr.write(`p2a1-fixture-geometry-progress ${p2a1GeometryResults.length}/${p2a2aFocusedOnly || p2a2bFocusedOnly || p2b1FocusedOnly || p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? 18 : 54}\n`);
    }
  }
  const p2a2aGeometryResults = [];
  if (p2a2aFocusedOnly || p2a2bFocusedOnly || p2b1FocusedOnly || p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused) for (const fixture of p2a2aFixtures) {
    const p2a2aViewports = p2a2bFocusedOnly || p2b1FocusedOnly || p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p2a2aViewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p2a2a-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P2A2a fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p2a2aGeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      if (p2a2aGeometryResults.length % 9 === 0) process.stderr.write(`p2a2a-fixture-geometry-progress ${p2a2aGeometryResults.length}/${p2a2bFocusedOnly || p2b1FocusedOnly || p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? 9 : 27}\n`);
    }
  }
  const p2a2bGeometryResults = [];
  if (p2a2bFocusedOnly || p2b1FocusedOnly || p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused) for (const fixture of p2a2bFixtures) {
    const p2a2bViewports = p2b1FocusedOnly || p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p2a2bViewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p2a2b-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P2A2b fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p2a2bGeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      const p2a2bExpected = p2b1FocusedOnly || p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? 29 : 87;
      if (p2a2bGeometryResults.length % 12 === 0 || p2a2bGeometryResults.length === p2a2bExpected) process.stderr.write(`p2a2b-fixture-geometry-progress ${p2a2bGeometryResults.length}/${p2a2bExpected}\n`);
    }
  }
  const p2b1GeometryResults = [];
  if (p2b1FocusedOnly || p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused) for (const fixture of p2b1Fixtures) {
    const p2b1Viewports = p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p2b1Viewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-content');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p2b1-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P2B1 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p2b1GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      const p2b1Expected = p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? 13 : 39;
      if (p2b1GeometryResults.length % 12 === 0 || p2b1GeometryResults.length === p2b1Expected) process.stderr.write(`p2b1-fixture-geometry-progress ${p2b1GeometryResults.length}/${p2b1Expected}\n`);
    }
  }
  const p2b2GeometryResults = [];
  if (p2b2FocusedOnly || p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused) for (const fixture of p2b2Fixtures) {
    const p2b2Viewports = p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p2b2Viewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p2b2-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P2B2 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p2b2GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      if (p2b2GeometryResults.length % 10 === 0) process.stderr.write(`p2b2-fixture-geometry-progress ${p2b2GeometryResults.length}/${p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? 10 : 30}\n`);
    }
  }
  const p3a1GeometryResults = [];
  if (p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused) for (const fixture of p3a1Fixtures) {
    const p3a1Viewports = p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p3a1Viewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-content');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p3a1-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P3A1 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p3a1GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      if (p3a1GeometryResults.length % 14 === 0) process.stderr.write(`p3a1-fixture-geometry-progress ${p3a1GeometryResults.length}/${p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? 14 : 42}\n`);
    }
  }
  const p3a2GeometryResults = [];
  if (p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused) for (const fixture of p3a2Fixtures) {
    const p3a2Viewports = p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p3a2Viewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-content');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p3a2-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P3A2 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p3a2GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      if (p3a2GeometryResults.length % 14 === 0) process.stderr.write(`p3a2-fixture-geometry-progress ${p3a2GeometryResults.length}/${p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? 14 : 42}\n`);
    }
  }
  const p3a3GeometryResults = [];
  if (p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused) for (const fixture of p3a3Fixtures) {
    const p3a3Viewports = p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p3a3Viewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-name') || fixture.fixtureId.includes('long-content');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p3a3-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P3A3 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p3a3GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      if (p3a3GeometryResults.length % 12 === 0) process.stderr.write(`p3a3-fixture-geometry-progress ${p3a3GeometryResults.length}/${p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? 12 : 36}\n`);
    }
  }
  const p3a4GeometryResults = [];
  if (p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused) for (const fixture of p3a4Fixtures) {
    const p3a4Viewports = p4a1FocusedOnly || p4a2OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p3a4Viewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-content') || fixture.fixtureId.includes('long-value') || fixture.fixtureId.includes('long-reason');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p3a4-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P3A4 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p3a4GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      if (p3a4GeometryResults.length % 22 === 0) process.stderr.write(`p3a4-fixture-geometry-progress ${p3a4GeometryResults.length}/${p4a1FocusedOnly || p4a2OrLaterFocused ? 22 : 66}\n`);
    }
  }
  const p4a1GeometryResults = [];
  if (p4a1FocusedOnly || p4a2OrLaterFocused) for (const fixture of p4a1Fixtures) {
    const p4a1Viewports = p4a2OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p4a1Viewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-name');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p4a1-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P4A1 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p4a1GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      if (p4a1GeometryResults.length % 11 === 0) process.stderr.write(`p4a1-fixture-geometry-progress ${p4a1GeometryResults.length}/${p4a2OrLaterFocused ? 11 : 33}\n`);
    }
  }
  const p4a2GeometryResults = [];
  if (p4a2OrLaterFocused) for (const fixture of p4a2Fixtures) {
    const p4a2Viewports = p4a3OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p4a2Viewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-') || fixture.fixtureId.includes('multiline');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p4a2-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P4A2 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p4a2GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      const expectedRuns = p4a2Fixtures.length * p4a2Viewports.length;
      if (p4a2GeometryResults.length % p4a2Fixtures.length === 0) process.stderr.write(`p4a2-fixture-geometry-progress ${p4a2GeometryResults.length}/${expectedRuns}\n`);
    }
  }
  const p4a3GeometryResults = [];
  if (p4a3OrLaterFocused) for (const fixture of p4a3Fixtures) {
    const p4a3Viewports = p4a4OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p4a3Viewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-') || fixture.fixtureId.includes('multiline');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p4a3-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P4A3 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p4a3GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      const expectedRuns = p4a3Fixtures.length * p4a3Viewports.length;
      if (p4a3GeometryResults.length % p4a3Fixtures.length === 0) process.stderr.write(`p4a3-fixture-geometry-progress ${p4a3GeometryResults.length}/${expectedRuns}\n`);
    }
  }
  const p4a4GeometryResults = [];
  if (p4a4OrLaterFocused) for (const fixture of p4a4Fixtures) {
    const p4a4Viewports = p4a5OrLaterFocused ? [[390, 844]] : viewports;
    for (const [width, height] of p4a4Viewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-') || fixture.fixtureId.includes('multiline');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p4a4-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P4A4 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p4a4GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      const expectedRuns = p4a4Fixtures.length * p4a4Viewports.length;
      if (p4a4GeometryResults.length % p4a4Fixtures.length === 0) process.stderr.write(`p4a4-fixture-geometry-progress ${p4a4GeometryResults.length}/${expectedRuns}\n`);
    }
  }
  const p4a5GeometryResults = [];
  if (p4a5OrLaterFocused) for (const fixture of p4a5Fixtures) {
    const p4a5Viewports = p5FocusedOnly ? [[390, 844]] : viewports;
    for (const [width, height] of p4a5Viewports) {
      const requiredScreenshot = width === 390 || fixture.fixtureId.includes('long-') || fixture.fixtureId.includes('multiline');
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = requiredScreenshot
        ? join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`)
        : null;
      const url = `http://127.0.0.1:${harnessPort}/?p4a5-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P4A5 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
      }
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p4a5GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot?.replace(`${evidenceRoot}/`, '') ?? null,
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && (screenshot === null || !existsSync(screenshot))) missingScreenshots += 1;
      const expectedRuns = p4a5Fixtures.length * p4a5Viewports.length;
      if (p4a5GeometryResults.length % p4a5Fixtures.length === 0) process.stderr.write(`p4a5-fixture-geometry-progress ${p4a5GeometryResults.length}/${expectedRuns}\n`);
    }
  }
  const p5GeometryResults = [];
  if (p5FocusedOnly) for (const fixture of p5Fixtures) {
    for (const [width, height] of viewports) {
      const requiredScreenshot = true;
      const safeFixtureId = fixture.fixtureId.replace(':', '-');
      const screenshot = join(evidenceRoot, 'screenshots', `${safeFixtureId}-${width}x${height}.png`);
      const url = `http://127.0.0.1:${harnessPort}/?p5-fixture=${encodeURIComponent(fixture.fixtureId)}&viewport=${width}x${height}`;
      consoleMessages.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      void cdp.command('Page.navigate', { url }).catch(() => undefined);
      let layout = null;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        try {
          const evaluated = await cdp.command('Runtime.evaluate', {
            expression: "document.querySelector('#layout-result')?.textContent ?? ''",
            returnByValue: true,
          });
          if (evaluated.result?.value) {
            const candidate = JSON.parse(evaluated.result.value);
            if (candidate.node_id === fixture.nodeId && candidate.fixture_id === fixture.fixtureId) {
              layout = candidate;
              break;
            }
          }
        } catch {}
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (layout === null) {
        const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        throw new Error(`P5 fixture layout result missing for ${fixture.fixtureId} ${width}x${height}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
      }
      const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
      writeFileSync(screenshot, captured.data, 'base64');
      const pageConsoleErrors = [...consoleMessages, ...(layout.browser_console_errors ?? [])];
      writeFileSync(join(evidenceRoot, 'console', `${safeFixtureId}-${width}x${height}.log`), pageConsoleErrors.join('\n'));
      p5GeometryResults.push({
        ...layout,
        viewport: { width, height },
        screenshot: screenshot.replace(`${evidenceRoot}/`, ''),
        console_error_count: pageConsoleErrors.length,
      });
      if (requiredScreenshot && !existsSync(screenshot)) missingScreenshots += 1;
      if (p5GeometryResults.length % p5Fixtures.length === 0) process.stderr.write(`p5-fixture-geometry-progress ${p5GeometryResults.length}/${p5Fixtures.length * viewports.length}\n`);
    }
  }
  const scenarioResults = [];
  let scenarioConsoleErrors = 0;
  const scenariosToRun = p3a1FocusedOnly || p3a2FocusedOnly || p3a3FocusedOnly || p3a4FocusedOnly || p4a1FocusedOnly || p4a2OrLaterFocused ? [] : p2b2FocusedOnly ? ['employee-salary'] : scenarios;
  if (!cardContentLinesOnly && (!focusedOnly || p2b2FocusedOnly)) for (const scenario of scenariosToRun) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    let scenarioResult = null;
    for (let attempt = 0; attempt < 400; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) { scenarioResult = JSON.parse(evaluated.result.value); break; }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`browser scenario failed: ${JSON.stringify(scenarioResult)}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `scenario-${scenario}.log`), consoleMessages.join('\n'));
    scenarioResults.push(scenarioResult);
    process.stderr.write(`browser-scenario-progress ${scenarioResults.length}/${scenariosToRun.length} ${scenario}\n`);
  }
  const p1DomScenarioResults = [];
  if (!cardContentLinesOnly && !focusedOnly) for (const scenario of p1DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p1-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p1-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) { scenarioResult = JSON.parse(evaluated.result.value); break; }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P1 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P1 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p1-dom-${scenario}.log`), consoleMessages.join('\n'));
    p1DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p1-dom-scenario-progress ${p1DomScenarioResults.length}/8 ${scenario}\n`);
  }
  const p2a1DomScenarioResults = [];
  if (p2a1FocusedOnly) for (const scenario of p2a1DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p2a1-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p2a1-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P2A1 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P2A1 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p2a1-dom-${scenario}.log`), consoleMessages.join('\n'));
    p2a1DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p2a1-dom-scenario-progress ${p2a1DomScenarioResults.length}/3 ${scenario}\n`);
  }
  const p2a2aDomScenarioResults = [];
  if (p2a2aFocusedOnly) for (const scenario of p2a2aDomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p2a2a-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p2a2a-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P2A2a DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P2A2a DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p2a2a-dom-${scenario}.log`), consoleMessages.join('\n'));
    p2a2aDomScenarioResults.push(scenarioResult);
    process.stderr.write(`p2a2a-dom-scenario-progress ${p2a2aDomScenarioResults.length}/3 ${scenario}\n`);
  }
  const p2a2bDomScenarioResults = [];
  if (p2a2bFocusedOnly) for (const scenario of p2a2bDomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p2a2b-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p2a2b-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P2A2b DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P2A2b DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p2a2b-dom-${scenario}.log`), consoleMessages.join('\n'));
    p2a2bDomScenarioResults.push(scenarioResult);
    process.stderr.write(`p2a2b-dom-scenario-progress ${p2a2bDomScenarioResults.length}/4 ${scenario}\n`);
  }
  const p2b1DomScenarioResults = [];
  if (p2b1FocusedOnly) for (const scenario of p2b1DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p2b1-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p2b1-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P2B1 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P2B1 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p2b1-dom-${scenario}.log`), consoleMessages.join('\n'));
    p2b1DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p2b1-dom-scenario-progress ${p2b1DomScenarioResults.length}/3 ${scenario}\n`);
  }
  const p2b2DomScenarioResults = [];
  if (p2b2FocusedOnly) for (const scenario of p2b2DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p2b2-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p2b2-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P2B2 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P2B2 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p2b2-dom-${scenario}.log`), consoleMessages.join('\n'));
    p2b2DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p2b2-dom-scenario-progress ${p2b2DomScenarioResults.length}/2 ${scenario}\n`);
  }
  const p3a1DomScenarioResults = [];
  if (p3a1FocusedOnly) for (const scenario of p3a1DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p3a1-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p3a1-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P3A1 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P3A1 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p3a1-dom-${scenario}.log`), consoleMessages.join('\n'));
    p3a1DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p3a1-dom-scenario-progress ${p3a1DomScenarioResults.length}/3 ${scenario}\n`);
  }
  const p3a2DomScenarioResults = [];
  if (p3a2FocusedOnly) for (const scenario of p3a2DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p3a2-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p3a2-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P3A2 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P3A2 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p3a2-dom-${scenario}.log`), consoleMessages.join('\n'));
    p3a2DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p3a2-dom-scenario-progress ${p3a2DomScenarioResults.length}/3 ${scenario}\n`);
  }
  const p3a3DomScenarioResults = [];
  if (p3a3FocusedOnly) for (const scenario of p3a3DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p3a3-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p3a3-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P3A3 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P3A3 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p3a3-dom-${scenario}.log`), consoleMessages.join('\n'));
    p3a3DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p3a3-dom-scenario-progress ${p3a3DomScenarioResults.length}/3 ${scenario}\n`);
  }
  const p3a4DomScenarioResults = [];
  if (p3a4FocusedOnly) for (const scenario of p3a4DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p3a4-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p3a4-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P3A4 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P3A4 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p3a4-dom-${scenario}.log`), consoleMessages.join('\n'));
    p3a4DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p3a4-dom-scenario-progress ${p3a4DomScenarioResults.length}/3 ${scenario}\n`);
  }
  const p4a1DomScenarioResults = [];
  if (p4a1FocusedOnly) for (const scenario of p4a1DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p4a1-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p4a1-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P4A1 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P4A1 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p4a1-dom-${scenario}.log`), consoleMessages.join('\n'));
    p4a1DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p4a1-dom-scenario-progress ${p4a1DomScenarioResults.length}/3 ${scenario}\n`);
  }
  const p4a2DomScenarioResults = [];
  if (p4a2OrLaterFocused) for (const scenario of p4a2DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p4a2-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 500; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p4a2-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P4A2 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P4A2 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p4a2-dom-${scenario}.log`), consoleMessages.join('\n'));
    p4a2DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p4a2-dom-scenario-progress ${p4a2DomScenarioResults.length}/${p4a2DomScenarios.length} ${scenario}\n`);
  }
  const p4a3DomScenarioResults = [];
  if (p4a3OrLaterFocused) for (const scenario of p4a3DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p4a3-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', correctiveDomViewport);
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 500; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p4a3-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P4A3 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P4A3 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    const layout = await cdp.command('Runtime.evaluate', {
      expression: '({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })',
      returnByValue: true,
    });
    if (layout.result?.value?.scrollWidth > layout.result?.value?.innerWidth) {
      throw new Error(`P4A3 DOM scenario overflow: ${JSON.stringify(layout.result.value)}.`);
    }
    const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(join(evidenceRoot, 'screenshots', `p4a3-dom-${scenario}-${correctiveDomWidth}.png`), Buffer.from(captured.data, 'base64'));
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p4a3-dom-${scenario}.log`), consoleMessages.join('\n'));
    p4a3DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p4a3-dom-scenario-progress ${p4a3DomScenarioResults.length}/${p4a3DomScenarios.length} ${scenario}\n`);
  }
  const p4a4DomScenarioResults = [];
  if (p4a4OrLaterFocused) for (const scenario of p4a4DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p4a4-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', correctiveDomViewport);
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p4a4-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P4A4 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P4A4 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    const layout = await cdp.command('Runtime.evaluate', {
      expression: '({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })',
      returnByValue: true,
    });
    if (layout.result?.value?.scrollWidth > layout.result?.value?.innerWidth) {
      throw new Error(`P4A4 DOM scenario overflow: ${JSON.stringify(layout.result.value)}.`);
    }
    const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(join(evidenceRoot, 'screenshots', `p4a4-dom-${scenario}-${correctiveDomWidth}.png`), Buffer.from(captured.data, 'base64'));
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p4a4-dom-${scenario}.log`), consoleMessages.join('\n'));
    p4a4DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p4a4-dom-scenario-progress ${p4a4DomScenarioResults.length}/${p4a4DomScenarios.length} ${scenario}\n`);
  }
  const p4a5DomScenarioResults = [];
  if (p4a5OrLaterFocused) for (const scenario of p4a5DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p4a5-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p4a5-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P4A5 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P4A5 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p4a5-dom-${scenario}.log`), consoleMessages.join('\n'));
    p4a5DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p4a5-dom-scenario-progress ${p4a5DomScenarioResults.length}/${p4a5DomScenarios.length} ${scenario}\n`);
  }
  const p5DomScenarioResults = [];
  if (p5FocusedOnly) for (const scenario of p5DomScenarios) {
    consoleMessages.length = 0;
    const url = `http://127.0.0.1:${harnessPort}/?p5-dom-scenario=${encodeURIComponent(scenario)}`;
    await cdp.command('Emulation.setDeviceMetricsOverride', correctiveDomViewport);
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    let scenarioResult = null;
    for (let attempt = 0; attempt < 800; attempt += 1) {
      try {
        const evaluated = await cdp.command('Runtime.evaluate', {
          expression: "document.querySelector('#p5-dom-scenario-result')?.textContent ?? ''",
          returnByValue: true,
        });
        if (evaluated.result?.value) {
          scenarioResult = JSON.parse(evaluated.result.value);
          break;
        }
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    if (scenarioResult === null) {
      const debug = await cdp.command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
      throw new Error(`P5 DOM scenario result missing for ${scenario}\nconsole=${consoleMessages.join('\n')}\ndom=${debug.result?.value}`);
    }
    if (scenarioResult.scenario !== scenario || scenarioResult.status !== 'PASS' || scenarioResult.external_requests !== 0) {
      throw new Error(`P5 DOM scenario failed: ${JSON.stringify(scenarioResult)}\nconsole=${consoleMessages.join('\n')}`);
    }
    const layout = await cdp.command('Runtime.evaluate', {
      expression: '({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })',
      returnByValue: true,
    });
    if (layout.result?.value?.scrollWidth > layout.result?.value?.innerWidth) {
      throw new Error(`P5 DOM scenario overflow: ${JSON.stringify(layout.result.value)}.`);
    }
    const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(join(evidenceRoot, 'screenshots', `p5-dom-${scenario}-${correctiveDomWidth}.png`), Buffer.from(captured.data, 'base64'));
    scenarioConsoleErrors += consoleMessages.length;
    writeFileSync(join(evidenceRoot, 'console', `p5-dom-${scenario}.log`), consoleMessages.join('\n'));
    p5DomScenarioResults.push(scenarioResult);
    process.stderr.write(`p5-dom-scenario-progress ${p5DomScenarioResults.length}/${p5DomScenarios.length} ${scenario}\n`);
  }
  const geometryFailures = results.filter((result) => result.status !== 'PASS').length;
  const p1GeometryFailures = p1GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p2a1GeometryFailures = p2a1GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p2a2aGeometryFailures = p2a2aGeometryResults.filter((result) => result.status !== 'PASS').length;
  const p2a2bGeometryFailures = p2a2bGeometryResults.filter((result) => result.status !== 'PASS').length;
  const p2b1GeometryFailures = p2b1GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p2b2GeometryFailures = p2b2GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p3a1GeometryFailures = p3a1GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p3a2GeometryFailures = p3a2GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p3a3GeometryFailures = p3a3GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p3a4GeometryFailures = p3a4GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p4a1GeometryFailures = p4a1GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p4a2GeometryFailures = p4a2GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p4a3GeometryFailures = p4a3GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p4a4GeometryFailures = p4a4GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p4a5GeometryFailures = p4a5GeometryResults.filter((result) => result.status !== 'PASS').length;
  const p5GeometryFailures = p5GeometryResults.filter((result) => result.status !== 'PASS').length;
  const measuredLayoutResults = [
    ...results,
    ...p1GeometryResults,
    ...p2a1GeometryResults,
    ...p2a2aGeometryResults,
    ...p2a2bGeometryResults,
    ...p2b1GeometryResults,
    ...p2b2GeometryResults,
    ...p3a1GeometryResults,
    ...p3a2GeometryResults,
    ...p3a3GeometryResults,
    ...p3a4GeometryResults,
    ...p4a1GeometryResults,
    ...p4a2GeometryResults,
    ...p4a3GeometryResults,
    ...p4a4GeometryResults,
    ...p4a5GeometryResults,
    ...p5GeometryResults,
  ];
  const semanticAuthorityFailures = measuredLayoutResults.reduce(
    (count, result) => count + (result.semantic_failures?.length ?? 0),
    0,
  );
  const computedPaintFailures = measuredLayoutResults.reduce(
    (count, result) => count + (result.computed_paint_failures?.length ?? 0),
    0,
  );
  const platformGeometryFailures = measuredLayoutResults.reduce(
    (count, result) => count + (result.platform_geometry_failures?.length ?? 0),
    0,
  );
  const executableNodeCoverage = registeredExecutableNodes.size;
  const p2a1LongGrowthFailures = p2a1GeometryResults.filter((result) =>
    result.fixture_id?.includes('long-content') &&
    result.long_content_height <= result.long_content_min_height + 1).length;
  const p4a5LongGrowthFailures = p4a5GeometryResults.filter((result) =>
    result.fixture_id?.includes('long-multiline-content') &&
    result.long_content_height <= result.long_content_min_height + 1).length;
  const p5LongGrowthFailures = 0;
  const summary = {
    corrective_dom_viewport: correctiveDomViewport,
    nodes_passed: new Set(results.filter((result) => result.status === 'PASS').map((result) => result.node_id)).size,
    viewport_runs_passed: results.filter((result) => result.status === 'PASS').length,
    scenarios_passed: scenarioResults.filter((result) => result.status === 'PASS').length,
    executable_node_coverage: executableNodeCoverage,
    p1_dom_scenarios_passed: p1DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p1_fixture_variants_passed: new Set(p1GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p1_fixture_viewport_runs_passed: p1GeometryResults.filter((result) => result.status === 'PASS').length,
    p2a1_dom_scenarios_passed: p2a1DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p2a1_fixture_variants_passed: new Set(p2a1GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p2a1_fixture_viewport_runs_passed: p2a1GeometryResults.filter((result) => result.status === 'PASS').length,
    p2a1_overlap_count: p2a1GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p2a1_clipping_count: p2a1GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p2a1_horizontal_overflow_count: p2a1GeometryResults.filter((result) => result.horizontal_overflow).length,
    p2a1_long_growth_failures: p2a1LongGrowthFailures,
    p2a2a_dom_scenarios_passed: p2a2aDomScenarioResults.filter((result) => result.status === 'PASS').length,
    p2a2a_fixture_variants_passed: new Set(p2a2aGeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p2a2a_fixture_viewport_runs_passed: p2a2aGeometryResults.filter((result) => result.status === 'PASS').length,
    p2a2a_overlap_count: p2a2aGeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p2a2a_clipping_count: p2a2aGeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p2a2a_horizontal_overflow_count: p2a2aGeometryResults.filter((result) => result.horizontal_overflow).length,
    p2a2b_dom_scenarios_passed: p2a2bDomScenarioResults.filter((result) => result.status === 'PASS').length,
    p2a2b_fixture_variants_passed: new Set(p2a2bGeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p2a2b_fixture_viewport_runs_passed: p2a2bGeometryResults.filter((result) => result.status === 'PASS').length,
    p2a2b_overlap_count: p2a2bGeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p2a2b_clipping_count: p2a2bGeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p2a2b_horizontal_overflow_count: p2a2bGeometryResults.filter((result) => result.horizontal_overflow).length,
    p2b1_dom_scenarios_passed: p2b1DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p2b1_fixture_variants_passed: new Set(p2b1GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p2b1_fixture_viewport_runs_passed: p2b1GeometryResults.filter((result) => result.status === 'PASS').length,
    p2b1_overlap_count: p2b1GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p2b1_clipping_count: p2b1GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p2b1_horizontal_overflow_count: p2b1GeometryResults.filter((result) => result.horizontal_overflow).length,
    p2b2_dom_scenarios_passed: p2b2DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p2b2_fixture_variants_passed: new Set(p2b2GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p2b2_fixture_viewport_runs_passed: p2b2GeometryResults.filter((result) => result.status === 'PASS').length,
    p2b2_overlap_count: p2b2GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p2b2_clipping_count: p2b2GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p2b2_horizontal_overflow_count: p2b2GeometryResults.filter((result) => result.horizontal_overflow).length,
    p3a1_dom_scenarios_passed: p3a1DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p3a1_fixture_variants_passed: new Set(p3a1GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p3a1_fixture_viewport_runs_passed: p3a1GeometryResults.filter((result) => result.status === 'PASS').length,
    p3a1_overlap_count: p3a1GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p3a1_clipping_count: p3a1GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p3a1_horizontal_overflow_count: p3a1GeometryResults.filter((result) => result.horizontal_overflow).length,
    p3a2_dom_scenarios_passed: p3a2DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p3a2_fixture_variants_passed: new Set(p3a2GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p3a2_fixture_viewport_runs_passed: p3a2GeometryResults.filter((result) => result.status === 'PASS').length,
    p3a2_overlap_count: p3a2GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p3a2_clipping_count: p3a2GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p3a2_horizontal_overflow_count: p3a2GeometryResults.filter((result) => result.horizontal_overflow).length,
    p3a3_dom_scenarios_passed: p3a3DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p3a3_fixture_variants_passed: new Set(p3a3GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p3a3_fixture_viewport_runs_passed: p3a3GeometryResults.filter((result) => result.status === 'PASS').length,
    p3a3_overlap_count: p3a3GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p3a3_clipping_count: p3a3GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p3a3_horizontal_overflow_count: p3a3GeometryResults.filter((result) => result.horizontal_overflow).length,
    p3a4_dom_scenarios_passed: p3a4DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p3a4_fixture_variants_passed: new Set(p3a4GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p3a4_fixture_viewport_runs_passed: p3a4GeometryResults.filter((result) => result.status === 'PASS').length,
    p3a4_overlap_count: p3a4GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p3a4_clipping_count: p3a4GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p3a4_horizontal_overflow_count: p3a4GeometryResults.filter((result) => result.horizontal_overflow).length,
    p4a1_dom_scenarios_passed: p4a1DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p4a1_fixture_variants_passed: new Set(p4a1GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p4a1_fixture_viewport_runs_passed: p4a1GeometryResults.filter((result) => result.status === 'PASS').length,
    p4a1_overlap_count: p4a1GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p4a1_clipping_count: p4a1GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p4a1_horizontal_overflow_count: p4a1GeometryResults.filter((result) => result.horizontal_overflow).length,
    p4a2_dom_scenarios_passed: p4a2DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p4a2_fixture_variants_passed: new Set(p4a2GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p4a2_fixture_viewport_runs_passed: p4a2GeometryResults.filter((result) => result.status === 'PASS').length,
    p4a2_valid_fixture_count: p4a2Fixtures.length,
    p4a2_overlap_count: p4a2GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p4a2_clipping_count: p4a2GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p4a2_horizontal_overflow_count: p4a2GeometryResults.filter((result) => result.horizontal_overflow).length,
    p4a3_dom_scenarios_passed: p4a3DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p4a3_fixture_variants_passed: new Set(p4a3GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p4a3_fixture_viewport_runs_passed: p4a3GeometryResults.filter((result) => result.status === 'PASS').length,
    p4a3_total_fixture_count: p4a3FixtureIds.length,
    p4a3_valid_fixture_count: p4a3Fixtures.length,
    p4a3_fail_closed_fixture_count: p4a3FailClosedSuffixes.size,
    p4a3_overlap_count: p4a3GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p4a3_clipping_count: p4a3GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p4a3_horizontal_overflow_count: p4a3GeometryResults.filter((result) => result.horizontal_overflow).length,
    p4a4_dom_scenarios_passed: p4a4DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p4a4_fixture_variants_passed: new Set(p4a4GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p4a4_fixture_viewport_runs_passed: p4a4GeometryResults.filter((result) => result.status === 'PASS').length,
    p4a4_total_fixture_count: p4a4FixtureIds.length,
    p4a4_valid_fixture_count: p4a4Fixtures.length,
    p4a4_fail_closed_fixture_count: p4a4FailClosedSuffixes.size,
    p4a4_overlap_count: p4a4GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p4a4_clipping_count: p4a4GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p4a4_horizontal_overflow_count: p4a4GeometryResults.filter((result) => result.horizontal_overflow).length,
    p4a5_dom_scenarios_passed: p4a5DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p4a5_fixture_variants_passed: new Set(p4a5GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p4a5_fixture_viewport_runs_passed: p4a5GeometryResults.filter((result) => result.status === 'PASS').length,
    p4a5_total_fixture_count: p4a5FixtureEntries.length,
    p4a5_valid_fixture_count: p4a5Fixtures.length,
    p4a5_fail_closed_fixture_count: p4a5FixtureEntries.length - p4a5Fixtures.length,
    p4a5_overlap_count: p4a5GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p4a5_clipping_count: p4a5GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p4a5_horizontal_overflow_count: p4a5GeometryResults.filter((result) => result.horizontal_overflow).length,
    p4a5_long_growth_failures: p4a5LongGrowthFailures,
    p5_dom_scenarios_passed: p5DomScenarioResults.filter((result) => result.status === 'PASS').length,
    p5_fixture_variants_passed: new Set(p5GeometryResults.filter((result) => result.status === 'PASS').map((result) => result.fixture_id)).size,
    p5_fixture_viewport_runs_passed: p5GeometryResults.filter((result) => result.status === 'PASS').length,
    p5_total_fixture_count: p5FixtureEntries.length,
    p5_valid_fixture_count: p5Fixtures.length,
    p5_fail_closed_fixture_count: p5FixtureEntries.length - p5Fixtures.length,
    p5_overlap_count: p5GeometryResults.reduce((count, result) => count + result.overlap_count + result.fixed_overlap_count, 0),
    p5_clipping_count: p5GeometryResults.reduce((count, result) => count + result.card_line_clipping_count + result.control_overflow_count, 0),
    p5_horizontal_overflow_count: p5GeometryResults.filter((result) => result.horizontal_overflow).length,
    p5_long_growth_failures: p5LongGrowthFailures,
    card_content_line_viewports_passed: cardContentLineResults.filter((result) => result.status === 'PASS').length,
    card_content_line_overlap_count: cardContentLineResults.reduce((count, result) => count + result.overlap_count, 0),
    card_content_line_clipping_count: cardContentLineResults.reduce((count, result) => count + result.clipping_count, 0),
    geometry_failures: geometryFailures,
    p1_geometry_failures: p1GeometryFailures,
    p2a1_geometry_failures: p2a1GeometryFailures,
    p2a2a_geometry_failures: p2a2aGeometryFailures,
    p2a2b_geometry_failures: p2a2bGeometryFailures,
    p2b1_geometry_failures: p2b1GeometryFailures,
    p2b2_geometry_failures: p2b2GeometryFailures,
    p3a1_geometry_failures: p3a1GeometryFailures,
    p3a2_geometry_failures: p3a2GeometryFailures,
    p3a3_geometry_failures: p3a3GeometryFailures,
    p3a4_geometry_failures: p3a4GeometryFailures,
    p4a1_geometry_failures: p4a1GeometryFailures,
    p4a2_geometry_failures: p4a2GeometryFailures,
    p4a3_geometry_failures: p4a3GeometryFailures,
    p4a4_geometry_failures: p4a4GeometryFailures,
    p4a5_geometry_failures: p4a5GeometryFailures,
    p5_geometry_failures: p5GeometryFailures,
    semantic_root_observations: measuredLayoutResults.reduce((count, result) => count + (result.semantic_root_count ?? 0), 0),
    semantic_authority_failures: semanticAuthorityFailures,
    computed_paint_failures: computedPaintFailures,
    platform_geometry_failures: platformGeometryFailures,
    semantic_authority_coverage: [...new Set(measuredLayoutResults.flatMap((result) =>
      (result.semantic_roots ?? []).map((root) => `${root.authority_kind}:${root.surface}:${root.key}`),
    ))].sort(),
    unexpected_external_requests: unexpectedExternalRequests.size,
    unexpected_external_request_urls: [...unexpectedExternalRequests].sort(),
    console_errors: results.reduce((count, result) => count + result.console_error_count, 0) + p1GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p2a1GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p2a2aGeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p2a2bGeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p2b1GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p2b2GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p3a1GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p3a2GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p3a3GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p3a4GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p4a1GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p4a2GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p4a3GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p4a4GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p4a5GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + p5GeometryResults.reduce((count, result) => count + result.console_error_count, 0) + cardContentLineResults.reduce((count, result) => count + result.console_error_count, 0) + scenarioConsoleErrors,
    missing_screenshots: missingScreenshots,
    screenshot_count: [...results, ...p1GeometryResults, ...p2a1GeometryResults, ...p2a2aGeometryResults, ...p2a2bGeometryResults, ...p2b1GeometryResults, ...p2b2GeometryResults, ...p3a1GeometryResults, ...p3a2GeometryResults, ...p3a3GeometryResults, ...p3a4GeometryResults, ...p4a1GeometryResults, ...p4a2GeometryResults, ...p4a3GeometryResults, ...p4a4GeometryResults, ...p4a5GeometryResults, ...p5GeometryResults, ...cardContentLineResults].filter((result) => result.screenshot !== null).length,
    browser_executable: executable,
    browser_version: browserVersion,
    browser_command: '--headless=new --remote-debugging-port=<local>; Page.navigate; Emulation.setDeviceMetricsOverride; Page.captureScreenshot',
    fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p1.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p2a1_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p2a1Employees.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p2a2a_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p2a2aShiftClose.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p2a2b_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p2a2bBlockers.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p2b1_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p2b1CompletedWorks.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p2b2_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p2b2Salary.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p3a1_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p3a1AdditionalWorkRequests.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p3a2_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p3a2AdditionalWorkLifecycle.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p3a3_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p3a3AssignAdditionalWork.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p3a4_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p3a4AdditionalWorkAccrual.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p4a1_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p4a1CorrectionsEntry.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p4a2_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p4a2FinancialCorrectionCreate.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p4a3_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p4a3FinancialCorrectionReversal.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p4a4_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p4a4ProductionCorrection.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p4a5_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p4a5Notifications.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    p5_fixture_fingerprint: spawnSync('sha256sum', ['src/section03/fixtures/p5Reports.ts'], { cwd: miniapp, encoding: 'utf8' }).stdout.split(/\s+/)[0],
    long_content_auto_height: [...results, ...p1GeometryResults, ...p2a1GeometryResults, ...p2a2aGeometryResults, ...p2a2bGeometryResults, ...p2b1GeometryResults, ...p2b2GeometryResults, ...p3a1GeometryResults, ...p3a2GeometryResults, ...p3a3GeometryResults, ...p3a4GeometryResults, ...p4a1GeometryResults, ...p4a2GeometryResults, ...p4a3GeometryResults, ...p4a4GeometryResults, ...p4a5GeometryResults, ...p5GeometryResults].length === 0 ? 0 : Math.max(...[...results, ...p1GeometryResults, ...p2a1GeometryResults, ...p2a2aGeometryResults, ...p2a2bGeometryResults, ...p2b1GeometryResults, ...p2b2GeometryResults, ...p3a1GeometryResults, ...p3a2GeometryResults, ...p3a3GeometryResults, ...p3a4GeometryResults, ...p4a1GeometryResults, ...p4a2GeometryResults, ...p4a3GeometryResults, ...p4a4GeometryResults, ...p4a5GeometryResults, ...p5GeometryResults].map((result) => result.long_content_height - result.long_content_min_height)),
  };
  writeFileSync(join(evidenceRoot, 'result.json'), JSON.stringify({ results, p1_fixture_results: p1GeometryResults, p2a1_fixture_results: p2a1GeometryResults, p2a2a_fixture_results: p2a2aGeometryResults, p2a2b_fixture_results: p2a2bGeometryResults, p2b1_fixture_results: p2b1GeometryResults, p2b2_fixture_results: p2b2GeometryResults, p3a1_fixture_results: p3a1GeometryResults, p3a2_fixture_results: p3a2GeometryResults, p3a3_fixture_results: p3a3GeometryResults, p3a4_fixture_results: p3a4GeometryResults, p4a1_fixture_results: p4a1GeometryResults, p4a2_fixture_results: p4a2GeometryResults, p4a3_fixture_results: p4a3GeometryResults, p4a4_fixture_results: p4a4GeometryResults, p4a5_fixture_results: p4a5GeometryResults, p5_fixture_results: p5GeometryResults, card_content_line_results: cardContentLineResults, scenarios: scenarioResults, p1_dom_scenarios: p1DomScenarioResults, p2a1_dom_scenarios: p2a1DomScenarioResults, p2a2a_dom_scenarios: p2a2aDomScenarioResults, p2a2b_dom_scenarios: p2a2bDomScenarioResults, p2b1_dom_scenarios: p2b1DomScenarioResults, p2b2_dom_scenarios: p2b2DomScenarioResults, p3a1_dom_scenarios: p3a1DomScenarioResults, p3a2_dom_scenarios: p3a2DomScenarioResults, p3a3_dom_scenarios: p3a3DomScenarioResults, p3a4_dom_scenarios: p3a4DomScenarioResults, p4a1_dom_scenarios: p4a1DomScenarioResults, p4a2_dom_scenarios: p4a2DomScenarioResults, p4a3_dom_scenarios: p4a3DomScenarioResults, p4a4_dom_scenarios: p4a4DomScenarioResults, p4a5_dom_scenarios: p4a5DomScenarioResults, p5_dom_scenarios: p5DomScenarioResults }, null, 2));
  writeFileSync(join(evidenceRoot, 'summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(evidenceRoot, 'browser.json'), JSON.stringify({ executable, browserVersion }, null, 2));
  const p5FocusedGateFailed =
    summary.scenarios_passed !== 0 || summary.executable_node_coverage !== 64 ||
    summary.p1_fixture_variants_passed !== p1Fixtures.length || summary.p1_fixture_viewport_runs_passed !== p1Fixtures.length ||
    summary.p2a1_fixture_variants_passed !== p2a1Fixtures.length || summary.p2a1_fixture_viewport_runs_passed !== p2a1Fixtures.length ||
    summary.p2a2a_fixture_variants_passed !== p2a2aFixtures.length || summary.p2a2a_fixture_viewport_runs_passed !== p2a2aFixtures.length ||
    summary.p2a2b_fixture_variants_passed !== p2a2bFixtures.length || summary.p2a2b_fixture_viewport_runs_passed !== p2a2bFixtures.length ||
    summary.p2b1_fixture_variants_passed !== p2b1Fixtures.length || summary.p2b1_fixture_viewport_runs_passed !== p2b1Fixtures.length ||
    summary.p2b2_fixture_variants_passed !== p2b2Fixtures.length || summary.p2b2_fixture_viewport_runs_passed !== p2b2Fixtures.length ||
    summary.p3a1_fixture_variants_passed !== p3a1Fixtures.length || summary.p3a1_fixture_viewport_runs_passed !== p3a1Fixtures.length ||
    summary.p3a2_fixture_variants_passed !== p3a2Fixtures.length || summary.p3a2_fixture_viewport_runs_passed !== p3a2Fixtures.length ||
    summary.p3a3_fixture_variants_passed !== p3a3Fixtures.length || summary.p3a3_fixture_viewport_runs_passed !== p3a3Fixtures.length ||
    summary.p3a4_fixture_variants_passed !== p3a4Fixtures.length || summary.p3a4_fixture_viewport_runs_passed !== p3a4Fixtures.length ||
    summary.p4a1_fixture_variants_passed !== p4a1Fixtures.length || summary.p4a1_fixture_viewport_runs_passed !== p4a1Fixtures.length ||
    summary.p4a2_fixture_variants_passed !== p4a2Fixtures.length || summary.p4a2_fixture_viewport_runs_passed !== p4a2Fixtures.length || summary.p4a2_dom_scenarios_passed !== p4a2DomScenarios.length ||
    summary.p4a3_fixture_variants_passed !== p4a3Fixtures.length || summary.p4a3_fixture_viewport_runs_passed !== p4a3Fixtures.length || summary.p4a3_dom_scenarios_passed !== p4a3DomScenarios.length ||
    summary.p4a4_fixture_variants_passed !== p4a4Fixtures.length || summary.p4a4_fixture_viewport_runs_passed !== p4a4Fixtures.length || summary.p4a4_dom_scenarios_passed !== p4a4DomScenarios.length ||
    summary.p4a5_fixture_variants_passed !== p4a5Fixtures.length || summary.p4a5_fixture_viewport_runs_passed !== p4a5Fixtures.length || summary.p4a5_dom_scenarios_passed !== p4a5DomScenarios.length ||
    summary.p5_fixture_variants_passed !== p5Fixtures.length || summary.p5_fixture_viewport_runs_passed !== p5Fixtures.length * viewports.length ||
    summary.p5_total_fixture_count !== p5FixtureEntries.length || summary.p5_valid_fixture_count !== p5Fixtures.length || summary.p5_fail_closed_fixture_count !== p5FailClosedIds.size ||
    summary.p5_dom_scenarios_passed !== p5DomScenarios.length ||
    p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 ||
    p2b1GeometryFailures !== 0 || p2b2GeometryFailures !== 0 || p3a1GeometryFailures !== 0 || p3a2GeometryFailures !== 0 ||
    p3a3GeometryFailures !== 0 || p3a4GeometryFailures !== 0 || p4a1GeometryFailures !== 0 || p4a2GeometryFailures !== 0 ||
    p4a3GeometryFailures !== 0 || p4a4GeometryFailures !== 0 || p4a5GeometryFailures !== 0 || p5GeometryFailures !== 0 ||
    summary.p5_overlap_count !== 0 || summary.p5_clipping_count !== 0 || summary.p5_horizontal_overflow_count !== 0 ||
    summary.p5_long_growth_failures !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0;
  const authorityEvidenceFailed = !cardContentLinesOnly && !scenariosOnly && (
    summary.semantic_root_observations === 0 ||
    summary.semantic_authority_failures !== 0 ||
    summary.computed_paint_failures !== 0
  );
  const failed = summary.unexpected_external_requests !== 0 || authorityEvidenceFailed || (cardContentLinesOnly
    ? summary.card_content_line_viewports_passed !== 3 || summary.card_content_line_overlap_count !== 0 || summary.card_content_line_clipping_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p5FocusedOnly
      ? p5FocusedGateFailed
    : p4a5FocusedOnly
      ? summary.scenarios_passed !== 0 || summary.executable_node_coverage !== 64 || summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 9 || summary.p2a2b_fixture_variants_passed !== 29 || summary.p2a2b_fixture_viewport_runs_passed !== 29 || summary.p2b1_fixture_variants_passed !== 13 || summary.p2b1_fixture_viewport_runs_passed !== 13 || summary.p2b2_fixture_variants_passed !== 10 || summary.p2b2_fixture_viewport_runs_passed !== 10 || summary.p3a1_fixture_variants_passed !== 14 || summary.p3a1_fixture_viewport_runs_passed !== 14 || summary.p3a2_fixture_variants_passed !== 14 || summary.p3a2_fixture_viewport_runs_passed !== 14 || summary.p3a3_fixture_variants_passed !== 12 || summary.p3a3_fixture_viewport_runs_passed !== 12 || summary.p3a4_fixture_variants_passed !== 22 || summary.p3a4_fixture_viewport_runs_passed !== 22 || summary.p4a1_fixture_variants_passed !== 11 || summary.p4a1_fixture_viewport_runs_passed !== 11 || summary.p4a2_fixture_variants_passed !== p4a2Fixtures.length || summary.p4a2_fixture_viewport_runs_passed !== p4a2Fixtures.length || summary.p4a2_dom_scenarios_passed !== p4a2DomScenarios.length || summary.p4a3_fixture_variants_passed !== p4a3Fixtures.length || summary.p4a3_fixture_viewport_runs_passed !== p4a3Fixtures.length || summary.p4a3_dom_scenarios_passed !== p4a3DomScenarios.length || summary.p4a4_fixture_variants_passed !== p4a4Fixtures.length || summary.p4a4_fixture_viewport_runs_passed !== p4a4Fixtures.length || summary.p4a4_dom_scenarios_passed !== p4a4DomScenarios.length || summary.p4a5_fixture_variants_passed !== p4a5Fixtures.length || summary.p4a5_fixture_viewport_runs_passed !== p4a5Fixtures.length * viewports.length || summary.p4a5_total_fixture_count !== p4a5FixtureEntries.length || summary.p4a5_fail_closed_fixture_count !== p4a5FixtureEntries.length - p4a5Fixtures.length || summary.p4a5_dom_scenarios_passed !== p4a5DomScenarios.length || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 || p2b1GeometryFailures !== 0 || p2b2GeometryFailures !== 0 || p3a1GeometryFailures !== 0 || p3a2GeometryFailures !== 0 || p3a3GeometryFailures !== 0 || p3a4GeometryFailures !== 0 || p4a1GeometryFailures !== 0 || p4a2GeometryFailures !== 0 || p4a3GeometryFailures !== 0 || p4a4GeometryFailures !== 0 || p4a5GeometryFailures !== 0 || summary.p4a5_overlap_count !== 0 || summary.p4a5_clipping_count !== 0 || summary.p4a5_horizontal_overflow_count !== 0 || summary.p4a5_long_growth_failures !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p4a4FocusedOnly
      ? summary.scenarios_passed !== 0 || summary.executable_node_coverage !== 64 || summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 9 || summary.p2a2b_fixture_variants_passed !== 29 || summary.p2a2b_fixture_viewport_runs_passed !== 29 || summary.p2b1_fixture_variants_passed !== 13 || summary.p2b1_fixture_viewport_runs_passed !== 13 || summary.p2b2_fixture_variants_passed !== 10 || summary.p2b2_fixture_viewport_runs_passed !== 10 || summary.p3a1_fixture_variants_passed !== 14 || summary.p3a1_fixture_viewport_runs_passed !== 14 || summary.p3a2_fixture_variants_passed !== 14 || summary.p3a2_fixture_viewport_runs_passed !== 14 || summary.p3a3_fixture_variants_passed !== 12 || summary.p3a3_fixture_viewport_runs_passed !== 12 || summary.p3a4_fixture_variants_passed !== 22 || summary.p3a4_fixture_viewport_runs_passed !== 22 || summary.p4a1_fixture_variants_passed !== 11 || summary.p4a1_fixture_viewport_runs_passed !== 11 || summary.p4a2_fixture_variants_passed !== p4a2Fixtures.length || summary.p4a2_fixture_viewport_runs_passed !== p4a2Fixtures.length || summary.p4a3_fixture_variants_passed !== p4a3Fixtures.length || summary.p4a3_fixture_viewport_runs_passed !== p4a3Fixtures.length || summary.p4a3_dom_scenarios_passed !== p4a3DomScenarios.length || summary.p4a4_fixture_variants_passed !== 35 || summary.p4a4_fixture_viewport_runs_passed !== 105 || summary.p4a4_total_fixture_count !== 54 || summary.p4a4_fail_closed_fixture_count !== 19 || summary.p4a4_dom_scenarios_passed !== p4a4DomScenarios.length || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 || p2b1GeometryFailures !== 0 || p2b2GeometryFailures !== 0 || p3a1GeometryFailures !== 0 || p3a2GeometryFailures !== 0 || p3a3GeometryFailures !== 0 || p3a4GeometryFailures !== 0 || p4a1GeometryFailures !== 0 || p4a2GeometryFailures !== 0 || p4a3GeometryFailures !== 0 || p4a4GeometryFailures !== 0 || summary.p4a4_overlap_count !== 0 || summary.p4a4_clipping_count !== 0 || summary.p4a4_horizontal_overflow_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p4a3FocusedOnly
      ? summary.scenarios_passed !== 0 || summary.executable_node_coverage !== 64 || summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 9 || summary.p2a2b_fixture_variants_passed !== 29 || summary.p2a2b_fixture_viewport_runs_passed !== 29 || summary.p2b1_fixture_variants_passed !== 13 || summary.p2b1_fixture_viewport_runs_passed !== 13 || summary.p2b2_fixture_variants_passed !== 10 || summary.p2b2_fixture_viewport_runs_passed !== 10 || summary.p3a1_fixture_variants_passed !== 14 || summary.p3a1_fixture_viewport_runs_passed !== 14 || summary.p3a2_fixture_variants_passed !== 14 || summary.p3a2_fixture_viewport_runs_passed !== 14 || summary.p3a3_fixture_variants_passed !== 12 || summary.p3a3_fixture_viewport_runs_passed !== 12 || summary.p3a4_fixture_variants_passed !== 22 || summary.p3a4_fixture_viewport_runs_passed !== 22 || summary.p4a1_fixture_variants_passed !== 11 || summary.p4a1_fixture_viewport_runs_passed !== 11 || summary.p4a2_fixture_variants_passed !== p4a2Fixtures.length || summary.p4a2_fixture_viewport_runs_passed !== p4a2Fixtures.length || summary.p4a3_fixture_variants_passed !== p4a3Fixtures.length || summary.p4a3_fixture_viewport_runs_passed !== p4a3Fixtures.length * viewports.length || summary.p4a3_dom_scenarios_passed !== p4a3DomScenarios.length || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 || p2b1GeometryFailures !== 0 || p2b2GeometryFailures !== 0 || p3a1GeometryFailures !== 0 || p3a2GeometryFailures !== 0 || p3a3GeometryFailures !== 0 || p3a4GeometryFailures !== 0 || p4a1GeometryFailures !== 0 || p4a2GeometryFailures !== 0 || p4a3GeometryFailures !== 0 || summary.p4a3_overlap_count !== 0 || summary.p4a3_clipping_count !== 0 || summary.p4a3_horizontal_overflow_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p4a2OrLaterFocused
      ? summary.scenarios_passed !== 0 || summary.executable_node_coverage !== 64 || summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 9 || summary.p2a2b_fixture_variants_passed !== 29 || summary.p2a2b_fixture_viewport_runs_passed !== 29 || summary.p2b1_fixture_variants_passed !== 13 || summary.p2b1_fixture_viewport_runs_passed !== 13 || summary.p2b2_fixture_variants_passed !== 10 || summary.p2b2_fixture_viewport_runs_passed !== 10 || summary.p3a1_fixture_variants_passed !== 14 || summary.p3a1_fixture_viewport_runs_passed !== 14 || summary.p3a2_fixture_variants_passed !== 14 || summary.p3a2_fixture_viewport_runs_passed !== 14 || summary.p3a3_fixture_variants_passed !== 12 || summary.p3a3_fixture_viewport_runs_passed !== 12 || summary.p3a4_fixture_variants_passed !== 22 || summary.p3a4_fixture_viewport_runs_passed !== 22 || summary.p4a1_fixture_variants_passed !== 11 || summary.p4a1_fixture_viewport_runs_passed !== 11 || summary.p4a2_fixture_variants_passed !== p4a2Fixtures.length || summary.p4a2_fixture_viewport_runs_passed !== p4a2Fixtures.length * viewports.length || summary.p4a2_dom_scenarios_passed !== p4a2DomScenarios.length || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 || p2b1GeometryFailures !== 0 || p2b2GeometryFailures !== 0 || p3a1GeometryFailures !== 0 || p3a2GeometryFailures !== 0 || p3a3GeometryFailures !== 0 || p3a4GeometryFailures !== 0 || p4a1GeometryFailures !== 0 || p4a2GeometryFailures !== 0 || summary.p4a2_overlap_count !== 0 || summary.p4a2_clipping_count !== 0 || summary.p4a2_horizontal_overflow_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p4a1FocusedOnly
      ? summary.scenarios_passed !== 0 || summary.executable_node_coverage !== 64 || summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 9 || summary.p2a2b_fixture_variants_passed !== 29 || summary.p2a2b_fixture_viewport_runs_passed !== 29 || summary.p2b1_fixture_variants_passed !== 13 || summary.p2b1_fixture_viewport_runs_passed !== 13 || summary.p2b2_fixture_variants_passed !== 10 || summary.p2b2_fixture_viewport_runs_passed !== 10 || summary.p3a1_fixture_variants_passed !== 14 || summary.p3a1_fixture_viewport_runs_passed !== 14 || summary.p3a2_fixture_variants_passed !== 14 || summary.p3a2_fixture_viewport_runs_passed !== 14 || summary.p3a3_fixture_variants_passed !== 12 || summary.p3a3_fixture_viewport_runs_passed !== 12 || summary.p3a4_fixture_variants_passed !== 22 || summary.p3a4_fixture_viewport_runs_passed !== 22 || summary.p4a1_fixture_variants_passed !== 11 || summary.p4a1_fixture_viewport_runs_passed !== 33 || summary.p4a1_dom_scenarios_passed !== 3 || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 || p2b1GeometryFailures !== 0 || p2b2GeometryFailures !== 0 || p3a1GeometryFailures !== 0 || p3a2GeometryFailures !== 0 || p3a3GeometryFailures !== 0 || p3a4GeometryFailures !== 0 || p4a1GeometryFailures !== 0 || summary.p4a1_overlap_count !== 0 || summary.p4a1_clipping_count !== 0 || summary.p4a1_horizontal_overflow_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p3a4FocusedOnly
      ? summary.scenarios_passed !== 0 || summary.executable_node_coverage !== 64 || summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 9 || summary.p2a2b_fixture_variants_passed !== 29 || summary.p2a2b_fixture_viewport_runs_passed !== 29 || summary.p2b1_fixture_variants_passed !== 13 || summary.p2b1_fixture_viewport_runs_passed !== 13 || summary.p2b2_fixture_variants_passed !== 10 || summary.p2b2_fixture_viewport_runs_passed !== 10 || summary.p3a1_fixture_variants_passed !== 14 || summary.p3a1_fixture_viewport_runs_passed !== 14 || summary.p3a2_fixture_variants_passed !== 14 || summary.p3a2_fixture_viewport_runs_passed !== 14 || summary.p3a3_fixture_variants_passed !== 12 || summary.p3a3_fixture_viewport_runs_passed !== 12 || summary.p3a4_fixture_variants_passed !== 22 || summary.p3a4_fixture_viewport_runs_passed !== 66 || summary.p3a4_dom_scenarios_passed !== 3 || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 || p2b1GeometryFailures !== 0 || p2b2GeometryFailures !== 0 || p3a1GeometryFailures !== 0 || p3a2GeometryFailures !== 0 || p3a3GeometryFailures !== 0 || p3a4GeometryFailures !== 0 || summary.p3a4_overlap_count !== 0 || summary.p3a4_clipping_count !== 0 || summary.p3a4_horizontal_overflow_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p3a3FocusedOnly
      ? summary.scenarios_passed !== 0 || summary.executable_node_coverage !== 64 || summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 9 || summary.p2a2b_fixture_variants_passed !== 29 || summary.p2a2b_fixture_viewport_runs_passed !== 29 || summary.p2b1_fixture_variants_passed !== 13 || summary.p2b1_fixture_viewport_runs_passed !== 13 || summary.p2b2_fixture_variants_passed !== 10 || summary.p2b2_fixture_viewport_runs_passed !== 10 || summary.p3a1_fixture_variants_passed !== 14 || summary.p3a1_fixture_viewport_runs_passed !== 14 || summary.p3a2_fixture_variants_passed !== 14 || summary.p3a2_fixture_viewport_runs_passed !== 14 || summary.p3a3_fixture_variants_passed !== 12 || summary.p3a3_fixture_viewport_runs_passed !== 36 || summary.p3a3_dom_scenarios_passed !== 3 || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 || p2b1GeometryFailures !== 0 || p2b2GeometryFailures !== 0 || p3a1GeometryFailures !== 0 || p3a2GeometryFailures !== 0 || p3a3GeometryFailures !== 0 || summary.p3a3_overlap_count !== 0 || summary.p3a3_clipping_count !== 0 || summary.p3a3_horizontal_overflow_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p3a2FocusedOnly
      ? summary.scenarios_passed !== 0 || summary.executable_node_coverage !== 64 || summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 9 || summary.p2a2b_fixture_variants_passed !== 29 || summary.p2a2b_fixture_viewport_runs_passed !== 29 || summary.p2b1_fixture_variants_passed !== 13 || summary.p2b1_fixture_viewport_runs_passed !== 13 || summary.p2b2_fixture_variants_passed !== 10 || summary.p2b2_fixture_viewport_runs_passed !== 10 || summary.p3a1_fixture_variants_passed !== 14 || summary.p3a1_fixture_viewport_runs_passed !== 14 || summary.p3a2_fixture_variants_passed !== 14 || summary.p3a2_fixture_viewport_runs_passed !== 42 || summary.p3a2_dom_scenarios_passed !== 3 || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 || p2b1GeometryFailures !== 0 || p2b2GeometryFailures !== 0 || p3a1GeometryFailures !== 0 || p3a2GeometryFailures !== 0 || summary.p3a2_overlap_count !== 0 || summary.p3a2_clipping_count !== 0 || summary.p3a2_horizontal_overflow_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p3a1FocusedOnly
      ? summary.scenarios_passed !== 0 || summary.executable_node_coverage !== 64 || summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 9 || summary.p2a2b_fixture_variants_passed !== 29 || summary.p2a2b_fixture_viewport_runs_passed !== 29 || summary.p2b1_fixture_variants_passed !== 13 || summary.p2b1_fixture_viewport_runs_passed !== 13 || summary.p2b2_fixture_variants_passed !== 10 || summary.p2b2_fixture_viewport_runs_passed !== 10 || summary.p3a1_fixture_variants_passed !== 14 || summary.p3a1_fixture_viewport_runs_passed !== 42 || summary.p3a1_dom_scenarios_passed !== 3 || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 || p2b1GeometryFailures !== 0 || p2b2GeometryFailures !== 0 || p3a1GeometryFailures !== 0 || summary.p3a1_overlap_count !== 0 || summary.p3a1_clipping_count !== 0 || summary.p3a1_horizontal_overflow_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p2b2FocusedOnly
      ? summary.scenarios_passed !== 1 || summary.executable_node_coverage !== 64 || summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 9 || summary.p2a2b_fixture_variants_passed !== 29 || summary.p2a2b_fixture_viewport_runs_passed !== 29 || summary.p2b1_fixture_variants_passed !== 13 || summary.p2b1_fixture_viewport_runs_passed !== 13 || summary.p2b2_fixture_variants_passed !== 10 || summary.p2b2_fixture_viewport_runs_passed !== 30 || summary.p2b2_dom_scenarios_passed !== 2 || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 || p2b1GeometryFailures !== 0 || p2b2GeometryFailures !== 0 || summary.p2b2_overlap_count !== 0 || summary.p2b2_clipping_count !== 0 || summary.p2b2_horizontal_overflow_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p2b1FocusedOnly
      ? summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 9 || summary.p2a2b_fixture_variants_passed !== 29 || summary.p2a2b_fixture_viewport_runs_passed !== 29 || summary.p2b1_fixture_variants_passed !== 13 || summary.p2b1_fixture_viewport_runs_passed !== 39 || summary.p2b1_dom_scenarios_passed !== 3 || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 || p2b1GeometryFailures !== 0 || summary.p2b1_overlap_count !== 0 || summary.p2b1_clipping_count !== 0 || summary.p2b1_horizontal_overflow_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p2a2bFocusedOnly
      ? summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 9 || summary.p2a2b_fixture_variants_passed !== 29 || summary.p2a2b_fixture_viewport_runs_passed !== 87 || summary.p2a2b_dom_scenarios_passed !== 4 || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || p2a2bGeometryFailures !== 0 || summary.p2a2b_overlap_count !== 0 || summary.p2a2b_clipping_count !== 0 || summary.p2a2b_horizontal_overflow_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p2a2aFocusedOnly
      ? summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 18 || summary.p2a2a_fixture_variants_passed !== 9 || summary.p2a2a_fixture_viewport_runs_passed !== 27 || summary.p2a2a_dom_scenarios_passed !== 3 || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || p2a2aGeometryFailures !== 0 || summary.p2a2a_overlap_count !== 0 || summary.p2a2a_clipping_count !== 0 || summary.p2a2a_horizontal_overflow_count !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : p2a1FocusedOnly
      ? summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 39 || summary.p2a1_fixture_variants_passed !== 18 || summary.p2a1_fixture_viewport_runs_passed !== 54 || summary.p2a1_dom_scenarios_passed !== 3 || p1GeometryFailures !== 0 || p2a1GeometryFailures !== 0 || summary.p2a1_overlap_count !== 0 || summary.p2a1_clipping_count !== 0 || summary.p2a1_horizontal_overflow_count !== 0 || summary.p2a1_long_growth_failures !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0
    : scenariosOnly
      ? summary.scenarios_passed !== 19 || summary.executable_node_coverage !== 64 || summary.p1_dom_scenarios_passed !== 8 || summary.console_errors !== 0
      : summary.nodes_passed !== 70 || summary.viewport_runs_passed !== 210 || summary.scenarios_passed !== 19 || summary.executable_node_coverage !== 64 || summary.p1_dom_scenarios_passed !== 8 || summary.p1_fixture_variants_passed !== 39 || summary.p1_fixture_viewport_runs_passed !== 117 || geometryFailures !== 0 || p1GeometryFailures !== 0 || summary.console_errors !== 0 || missingScreenshots !== 0);
  if (failed) {
    throw new Error(`browser parity gate failed: ${JSON.stringify(summary)}`);
  }
  process.stdout.write(`${JSON.stringify({ evidence_root: evidenceRoot, summary }, null, 2)}\n`);
  cdp.close();
} finally {
  server.kill('SIGTERM');
  browser.kill('SIGTERM');
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  if (browser.exitCode === null) browser.kill('SIGKILL');
  try { rmSync(harnessDist, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }); } catch {}
  try { rmSync(browserProfile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }); } catch {}
}
