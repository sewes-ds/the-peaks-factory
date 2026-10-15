import type { AppEntrypointResponse } from '../foundation/appEntrypoint';
import './section04.css';

export type Section04DirectorPlaceholderProps = {
  entrypoint: AppEntrypointResponse;
};

export function Section04DirectorPlaceholder({ entrypoint }: Section04DirectorPlaceholderProps) {
  return (
    <main className="section04-director" data-node-id="S04-N01" aria-label="Кабинет директора">
      <section className="section04-director__card">
        <div className="section04-director__code">S04-N01</div>
        <h1>Кабинет директора</h1>
        <p>Раздел 04 будет подключён отдельным рабочим пакетом.</p>
        <div className="section04-director__meta">
          <span>Контур: {entrypoint.contour}</span>
          <span>Источник: {entrypoint.resolution_source}</span>
        </div>
      </section>
    </main>
  );
}
