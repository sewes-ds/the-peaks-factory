import type { Section03ProductionCorrectionMode } from '../program/context';
import {
  resolveSection03ProductionCorrectionMath,
  type Section03ProductionCorrectionMath,
} from './productionCorrectionMath';

const mode: Section03ProductionCorrectionMode = 'increase';
const result: Section03ProductionCorrectionMath = resolveSection03ProductionCorrectionMath({
  mode,
  freshBaseQuantity: '10',
  correctionQuantity: '2.5',
});
const signed: string = result.signedCorrection;
void signed;
