import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Section04DirectorPlaceholder } from './Section04DirectorPlaceholder';

describe('Section 04 director boundary', () => {
  it('renders its single registered unavailable node without actions or synthetic data', () => {
    const html = renderToStaticMarkup(<Section04DirectorPlaceholder entrypoint={{
      section: 'section04',
      screen: 'S04-N01',
      contour: 'director',
      actor: { employee_id: 'EMP-DIRECTOR' },
      role_hints: ['director'],
      resolution_source: 'director_role',
    }} />);

    expect(html).toContain('data-node-id="S04-N01"');
    expect(html).toContain('Кабинет директора');
    expect(html).toContain('будет подключён отдельным рабочим пакетом');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('EMP-DIRECTOR');
  });
});
