import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const appSource = readFileSync('src/App.tsx', 'utf8');
const hostSource = readFileSync('src/legacy/section02/Section02OperatorPipelineHost.tsx', 'utf8');

describe('Section 02 salary routing/wiring ownership', () => {
  it('keeps salary route ownership in App', () => {
    expect(appSource).toContain("screenId: 'S02-SAL01' | 'S02-SAL02'");
    expect(appSource).toContain('getOperatorSalaryState');
    expect(appSource).toContain('<Section02SalarySummary');
    expect(appSource).toContain('<Section02SalaryHistory');
    expect(appSource).toContain("screenId: 'S02-SAL01'");
    expect(appSource).toContain("screenId: 'S02-SAL02'");
  });

  it('wires salary entry from S02-N01 and S02-N02 without moving ownership into PipelineHost', () => {
    expect(appSource).toContain('onOpenSalary={() => void openSalary()}');
    expect(hostSource).toContain('onOpenSalary?: () => void;');
    expect(hostSource).toContain('onOpenSalary={onOpenSalary}');
    expect(hostSource).not.toContain('Section02SalarySummary');
    expect(hostSource).not.toContain('Section02SalaryHistory');
    expect(hostSource).not.toContain("nodeId: 'S02-SAL01'");
    expect(hostSource).not.toContain("nodeId: 'S02-SAL02'");
  });
});
