import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Section 01 auth scope', () => {
  it('keeps Section 01 auth as the application entry point', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(appSource).toContain('Section01AuthApp');
    expect(appSource).toContain('onAuthenticated');
    expect(appSource).not.toContain('post-auth-loading');
    expect(appSource).not.toContain('post-auth-unavailable');
    expect(appSource).not.toContain('S02_SYSTEM_MESSAGE');
    expect(appSource).toContain('initialRoute={technicalFailureRoute()}');
  });

  it('does not expose manual phone input in Section 01 source', () => {
    const sectionSource = readFileSync(resolve(process.cwd(), 'src/section01/Section01AuthApp.tsx'), 'utf8');

    expect(sectionSource).not.toContain('type="tel"');
    expect(sectionSource).not.toContain('phone_e164');
  });
});
