import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src', import.meta.url));
const forbidden = [
  { name: 'direct INSERT', pattern: /\binsert\s+into\b/i },
  { name: 'direct UPDATE', pattern: /\bupdate\s+app\./i },
  { name: 'direct DELETE', pattern: /\bdelete\s+from\b/i },
  { name: 'TRUNCATE', pattern: /\btruncate\b/i },
  { name: 'admin runtime env', pattern: /\bDATABASE_ADMIN_URL\b/ },
  { name: 'migration role runtime env', pattern: /\bmigration_role\b/ },
  { name: 'postgres runtime identity', pattern: /\bpostgres\b/ },
  { name: 'helper function call', pattern: /\bapp\._[a-z0-9_]+\s*\(/i },
  { name: 'maintenance function call', pattern: /\brebuild_employee_salary_period_totals\s*\(/i }
];

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(path);
    }
    return statSync(path).isFile() && extname(path) === '.ts' ? [path] : [];
  });
}

const failures = [];

for (const file of listFiles(root)) {
  const content = readFileSync(file, 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(content)) {
      failures.push(`${rule.name}: ${file}`);
    }
  }
}

if (failures.length > 0) {
  console.error('SECURITY_SCAN_FAIL');
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log('SECURITY_SCAN_PASS');
