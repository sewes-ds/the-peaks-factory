import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { serializeManagerPresentationContractArtifact } from '../src/readModels/managerPresentationArtifact.js';

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing required ${name} argument.`);
  }
  return value;
}

const producerCommit = argument('--producer-commit');
const outputPath = resolve(argument('--output'));
const serialized = serializeManagerPresentationContractArtifact(producerCommit);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, serialized, 'utf8');
process.stdout.write(`${outputPath}\n`);
