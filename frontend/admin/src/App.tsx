import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  AdminApiError,
  changeAdminPassword,
  claimAdminTelegramQrChallenge,
  createAdminTelegramQrChallenge,
  downloadAdminQrLabel,
  loginAdmin,
  logoutAdmin,
  moveAdminActivityType,
  readAdminDirectory,
  readAdminOverview,
  readAdminSession
} from './api';
import type {
  ActivityClass,
  AdminDirectory,
  AdminOverview,
  AdminSession,
  AdminTelegramQrChallenge
} from './contracts';
import { ATTENTION_COPY, formatAdminDate, formatAuditAction } from './presentation';
import { CatalogEditorDialog, type CatalogEditorTarget } from './CatalogEditors';

export function App() {
  const [session, setSession] = useState<AdminSession | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    readAdminSession()
      .then((result) => {
        if (active) setSession(result);
      })
      .catch(() => {
        if (active) setSession(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (session === undefined) {
    return <LoadingScreen />;
  }
  if (session === null) {
    return <LoginScreen onAuthenticated={setSession} />;
  }
  if (session.must_change_password) {
    return (
      <PasswordChangeScreen
        session={session}
        onChanged={setSession}
        onLogout={() => setSession(null)}
      />
    );
  }

  return <AdminShell session={session} onLogout={() => setSession(null)} />;
}

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-live="polite">
      <div className="loading-mark" aria-hidden="true">P</div>
      <p>Проверяем сессию…</p>
    </main>
  );
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (session: AdminSession) => void }) {
  const [method, setMethod] = useState<'telegram-qr' | 'password'>('telegram-qr');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<AdminTelegramQrChallenge | null>(null);
  const [qrState, setQrState] = useState<'loading' | 'pending' | 'expired' | 'failed'>('loading');
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const [qrRetryKey, setQrRetryKey] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (method !== 'telegram-qr') return;

    let active = true;
    let pollTimer: number | undefined;
    setChallenge(null);
    setQrState('loading');
    setQrMessage(null);

    async function start() {
      try {
        const nextChallenge = await createAdminTelegramQrChallenge();
        if (!active) return;
        setChallenge(nextChallenge);
        setQrState('pending');
        schedulePoll(nextChallenge, nextChallenge.poll_after_ms);
      } catch (reason) {
        if (!active) return;
        setQrState('failed');
        setQrMessage(readErrorMessage(reason));
      }
    }

    function schedulePoll(currentChallenge: AdminTelegramQrChallenge, delayMs: number) {
      const boundedDelay = Math.max(750, Math.min(5_000, delayMs));
      pollTimer = window.setTimeout(() => void poll(currentChallenge), boundedDelay);
    }

    async function poll(currentChallenge: AdminTelegramQrChallenge) {
      if (!active) return;
      try {
        const result = await claimAdminTelegramQrChallenge(currentChallenge.challenge_id);
        if (!active) return;
        if (result.status === 'AUTHENTICATED') {
          onAuthenticated(result.session);
          return;
        }
        if (result.status === 'PENDING') {
          setQrMessage(null);
          schedulePoll(currentChallenge, currentChallenge.poll_after_ms);
          return;
        }
        if (result.status === 'FORBIDDEN') {
          setQrState('failed');
          setQrMessage('У подтверждённой Telegram-учётной записи нет доступа к админ-панели.');
          return;
        }
        setQrState(result.status === 'EXPIRED' ? 'expired' : 'failed');
        setQrMessage(
          result.status === 'EXPIRED'
            ? 'Срок действия QR-кода истёк.'
            : 'QR-код больше недоступен. Получите новый код.'
        );
      } catch {
        if (!active) return;
        if (new Date(currentChallenge.expires_at).getTime() <= Date.now()) {
          setQrState('expired');
          setQrMessage('Срок действия QR-кода истёк.');
          return;
        }
        setQrMessage('Связь временно прервана. Повторяем проверку…');
        schedulePoll(currentChallenge, 3_000);
      }
    }

    void start();
    return () => {
      active = false;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    };
  }, [method, onAuthenticated, qrRetryKey]);

  useEffect(() => {
    const expiresAt = challenge?.expires_at;
    if (!expiresAt || method !== 'telegram-qr') {
      setSecondsRemaining(0);
      return;
    }

    function updateRemaining() {
      setSecondsRemaining(Math.max(0, Math.ceil((new Date(expiresAt!).getTime() - Date.now()) / 1_000)));
    }
    updateRemaining();
    const countdownTimer = window.setInterval(updateRemaining, 1_000);
    return () => window.clearInterval(countdownTimer);
  }, [challenge?.expires_at, method]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      onAuthenticated(await loginAdmin(login, password));
    } catch (reason) {
      setError(readErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-brand" aria-label="PEAKS">
        <img className="auth-logo" src="/admin/assets/peaks_logo.png" alt="PEAKS" />
        <div className="brand-divider" />
        <p>Управление производственной системой</p>
        <small>Персональный и журналируемый доступ</small>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="eyebrow">PEAKS · УПРАВЛЕНИЕ</div>
          <h1>Административная панель</h1>
          {method === 'telegram-qr' ? (
            <>
              <p className="auth-lead">Отсканируйте QR-код камерой телефона — откроется Telegram</p>
              <div className={'telegram-qr-card is-' + qrState}>
                {challenge ? (
                  <img
                    className="telegram-qr-image"
                    src={challenge.qr_image_src}
                    alt="QR-код для входа через Telegram"
                  />
                ) : (
                  <div className="telegram-qr-placeholder" aria-hidden="true">
                    <span />
                  </div>
                )}
                <div className="telegram-qr-status" aria-live="polite">
                  <strong>{qrStatusTitle(qrState)}</strong>
                  <span>
                    {qrMessage ?? (
                      qrState === 'pending'
                        ? `Код действует ещё ${secondsRemaining} сек.`
                        : 'Формируем защищённый одноразовый код…'
                    )}
                  </span>
                </div>
              </div>
              {qrState === 'expired' || qrState === 'failed' ? (
                <button
                  className="secondary-button telegram-qr-retry"
                  type="button"
                  onClick={() => setQrRetryKey((value) => value + 1)}
                >
                  Обновить QR-код
                </button>
              ) : null}
              <button
                className="text-button auth-method-switch"
                type="button"
                onClick={() => {
                  setMethod('password');
                  setError(null);
                }}
              >
                Вход по паролю
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <p className="auth-lead">Войдите под своей учётной записью</p>

              <label className="field">
                <span>Логин</span>
                <input
                  autoFocus
                  autoComplete="username"
                  inputMode="text"
                  maxLength={64}
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  placeholder="Введите логин"
                  disabled={pending}
                />
              </label>

              <label className="field">
                <span>Пароль</span>
                <input
                  autoComplete="current-password"
                  maxLength={128}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Введите пароль"
                  disabled={pending}
                />
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                />
                <span>Показать пароль</span>
              </label>

              {error ? <div className="form-error" role="alert">{error}</div> : null}

              <button className="primary-button" type="submit" disabled={pending || !login || !password}>
                {pending ? 'Входим…' : 'Войти'}
              </button>
              <button
                className="text-button auth-method-switch"
                type="button"
                onClick={() => {
                  setMethod('telegram-qr');
                  setError(null);
                }}
              >
                Войти через QR-код
              </button>
            </form>
          )}

          <div className="security-note">
            <SecurityIcon />
            <p>Каждый вход и действие записываются в журнал.</p>
          </div>
          <p className="auth-access-note">Доступ предоставляется руководителям предприятия.</p>
        </div>
      </section>
    </main>
  );
}

function qrStatusTitle(state: 'loading' | 'pending' | 'expired' | 'failed'): string {
  switch (state) {
    case 'loading': return 'Создаём QR-код';
    case 'pending': return 'Ожидаем подтверждения';
    case 'expired': return 'QR-код устарел';
    case 'failed': return 'Не удалось выполнить вход';
  }
}

function PasswordChangeScreen({
  session,
  onChanged,
  onLogout
}: {
  session: AdminSession;
  onChanged: (session: AdminSession) => void;
  onLogout: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (newPassword !== confirmation) {
      setError('Подтверждение не совпадает с новым паролем');
      return;
    }
    setPending(true);
    setError(null);
    try {
      onChanged(await changeAdminPassword(currentPassword, newPassword));
    } catch (reason) {
      setError(readErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    try {
      await logoutAdmin();
    } finally {
      onLogout();
    }
  }

  return (
    <main className="password-layout">
      <section className="password-card">
        <div className="password-heading">
          <div className="shield-mark"><SecurityIcon /></div>
          <div>
            <div className="eyebrow">ПЕРВЫЙ ВХОД</div>
            <h1>Замените временный пароль</h1>
          </div>
        </div>
        <p className="password-intro">
          Здравствуйте, {session.full_name}. До смены временного пароля разделы управления недоступны.
        </p>

        <form onSubmit={submit}>
          <label className="field">
            <span>Текущий временный пароль</span>
            <input
              autoFocus
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              maxLength={128}
            />
          </label>
          <label className="field">
            <span>Новый пароль</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              maxLength={128}
            />
          </label>
          <label className="field">
            <span>Повторите новый пароль</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              maxLength={128}
            />
          </label>
          <p className="password-hint">
            Не менее 12 символов; используйте три группы: строчные, прописные, цифры или специальные знаки.
          </p>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button
            className="primary-button"
            type="submit"
            disabled={pending || !currentPassword || !newPassword || !confirmation}
          >
            {pending ? 'Сохраняем…' : 'Сохранить новый пароль'}
          </button>
        </form>
        <button className="text-button" type="button" onClick={logout}>Выйти из учетной записи</button>
      </section>
    </main>
  );
}

function AdminShell({
  session,
  onLogout
}: {
  session: AdminSession;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<AdminSection>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [directory, setDirectory] = useState<AdminDirectory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    readAdminOverview()
      .then((result) => {
        if (active) setOverview(result);
      })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof AdminApiError && reason.status === 401) {
          onLogout();
          return;
        }
        setError(readErrorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [onLogout]);

  useEffect(() => {
    let active = true;
    readAdminDirectory()
      .then((result) => {
        if (active) setDirectory(result);
      })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof AdminApiError && reason.status === 401) {
          onLogout();
          return;
        }
        setError(readErrorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [onLogout]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutAdmin();
    } finally {
      onLogout();
    }
  }

  async function refreshAfterMutation(message: string) {
    setNotice(message);
    setError(null);
    try {
      const [nextOverview, nextDirectory] = await Promise.all([
        readAdminOverview(),
        readAdminDirectory()
      ]);
      setOverview(nextOverview);
      setDirectory(nextDirectory);
    } catch (reason) {
      if (reason instanceof AdminApiError && reason.status === 401) {
        onLogout();
        return;
      }
      setError('Изменение сохранено, но не удалось обновить данные: ' + readErrorMessage(reason));
    }
  }

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/admin/assets/peaks_logo.png" alt="PEAKS" />
          <span>ADMIN</span>
        </div>
        <nav aria-label="Разделы администрирования">
          {ADMIN_SECTIONS.map((item) => (
            <button
              className={'nav-item' + (section === item.id ? ' is-active' : '')}
              type="button"
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => setSection(item.id)}
              key={item.id}
            >
              <NavIcon kind={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>Версия 1 · справочники</span>
          <small>Персональная сессия и журнал действий</small>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="eyebrow">PEAKS · СИСТЕМА УПРАВЛЕНИЯ</div>
            <h1>Административная панель</h1>
          </div>
          <div className="session-controls">
            <div className="user-avatar" aria-hidden="true">{initials(session.full_name)}</div>
            <div className="user-copy">
              <strong>{session.full_name}</strong>
              <span>{session.role_name}</span>
            </div>
            <button className="logout-button" type="button" onClick={logout} disabled={loggingOut}>
              {loggingOut ? 'Выходим…' : 'Выйти'}
            </button>
          </div>
        </header>

        <div className="workspace-content">
          <div className="page-heading">
            <div>
              <h2>{SECTION_COPY[section].title}</h2>
              <p>{SECTION_COPY[section].description}</p>
            </div>
            <div className="session-badge">
              <span className="status-dot" />
              Сессия активна до {formatTime(session.expires_at)}
            </div>
          </div>

          {error && <div className="page-error" role="alert">{error}</div>}
          {notice && <div className="page-notice" role="status">{notice}</div>}
          {section === 'overview' && !overview && !error && <OverviewSkeleton />}
          {section === 'overview' && overview && <OverviewContent overview={overview} />}
          {section !== 'overview' && !directory && !error && <DirectorySkeleton />}
          {section !== 'overview' && directory && (
            <DirectorySection
              key={section}
              section={section}
              directory={directory}
              onChanged={refreshAfterMutation}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function OverviewContent({ overview }: { overview: AdminOverview }) {
  const cards = [
    { label: 'Сотрудники', value: overview.counts.employees, meta: 'активные учетные записи', tone: 'blue' },
    { label: 'Станки', value: overview.counts.machines, meta: 'в справочнике', tone: 'green' },
    { label: 'SKU', value: overview.counts.skus, meta: 'активные позиции', tone: 'violet' },
    { label: 'Сессии', value: overview.counts.active_sessions, meta: 'сейчас активны', tone: 'amber' }
  ];

  return (
    <>
      <section className="metric-grid" aria-label="Сводные показатели">
        {cards.map((card) => (
          <article className="metric-card" key={card.label}>
            <div className={'metric-icon ' + card.tone}><NavIcon kind={metricIcon(card.label)} /></div>
            <div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.meta}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="content-card attention-card">
        <div className="card-heading">
          <div>
            <h3>Требует внимания</h3>
            <p>Проверки по текущему состоянию производственных данных</p>
          </div>
          <span className="counter-pill">
            {overview.attention.filter((item) => item.count > 0).length}
          </span>
        </div>
        <div className="attention-list">
          {overview.attention.map((item) => {
            const copy = ATTENTION_COPY[item.code];
            return (
              <div className="attention-row" key={item.code}>
                <span className={'attention-indicator ' + (item.count > 0 ? 'warning' : 'ok')} />
                <div>
                  <strong>{copy.title}</strong>
                  <span>{copy.description}</span>
                </div>
                <b>{item.count}</b>
              </div>
            );
          })}
        </div>
      </section>

      <section className="content-card audit-card">
        <div className="card-heading">
          <div>
            <h3>Последние действия</h3>
            <p>Безопасная выборка из журнала изменений</p>
          </div>
        </div>
        {overview.recent_actions.length === 0 ? (
          <div className="empty-state">Записей пока нет.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Действие</th>
                  <th>Пользователь</th>
                  <th>Объект</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {overview.recent_actions.map((action) => (
                  <tr key={action.audit_event_id}>
                    <td><strong>{formatAuditAction(action.action_name)}</strong></td>
                    <td>{action.actor_full_name}</td>
                    <td>{action.entity_table_name} · {action.entity_record_id}</td>
                    <td>{formatAdminDate(action.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function DirectorySection({
  section,
  directory,
  onChanged
}: {
  section: Exclude<AdminSection, 'overview'>;
  directory: AdminDirectory;
  onChanged: (message: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<CatalogEditorTarget | null>(null);
  const [downloadingQr, setDownloadingQr] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [activityActionError, setActivityActionError] = useState<string | null>(null);
  const [movingActivity, setMovingActivity] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase('ru');
  const includesQuery = (...values: Array<string | null | undefined>) => (
    normalizedQuery === ''
    || values.some((value) => value?.toLocaleLowerCase('ru').includes(normalizedQuery))
  );
  async function saved(message: string) {
    setEditor(null);
    await onChanged(message);
  }
  const dialog = editor && (
    <CatalogEditorDialog
      target={editor}
      directory={directory}
      onClose={() => setEditor(null)}
      onSaved={saved}
    />
  );
  async function downloadQr(resourceKind: 'MACHINE' | 'SKU', resourceId: string) {
    const key = resourceKind + ':' + resourceId;
    if (downloadingQr) return;
    setDownloadingQr(key);
    setDownloadError(null);
    try {
      const download = await downloadAdminQrLabel(resourceKind, resourceId);
      const url = URL.createObjectURL(download.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = download.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      await onChanged('QR-ярлык сформирован и скачан');
    } catch (reason) {
      setDownloadError(readErrorMessage(reason));
    } finally {
      setDownloadingQr(null);
    }
  }
  async function moveActivity(
    row: AdminDirectory['activity_types'][number],
    direction: 'UP' | 'DOWN'
  ) {
    const key = row.activity_class + ':' + row.activity_type_id;
    if (movingActivity) return;
    setMovingActivity(key);
    setActivityActionError(null);
    try {
      await moveAdminActivityType({
        activity_class: row.activity_class,
        activity_type_id: row.activity_type_id,
        direction
      });
      await onChanged('Порядок показа изменен');
    } catch (reason) {
      setActivityActionError(readErrorMessage(reason));
    } finally {
      setMovingActivity(null);
    }
  }

  if (section === 'employees') {
    const rows = directory.employees.filter((row) => includesQuery(
      row.full_name,
      row.phone_e164,
      row.position_name,
      row.employee_status_name,
      ...row.role_names
    ));
    return (
      <><DirectoryCard query={query} onQueryChange={setQuery} count={rows.length} actionLabel="Добавить сотрудника" onAction={() => setEditor({ kind: 'employee' })}>
        <table>
          <thead><tr><th>Сотрудник</th><th>Телефон</th><th>Должность</th><th>Роль</th><th>Статус</th><th>Telegram</th><th aria-label="Действия" /></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.employee_id}>
              <td><strong>{row.full_name}</strong><small className="cell-meta">ID {row.employee_id}</small></td>
              <td>{row.phone_e164}</td>
              <td>{row.position_name}</td>
              <td>{row.role_names.join(', ') || 'Не назначена'}</td>
              <td><StatusPill active={row.is_active_for_login} label={row.employee_status_name} /></td>
              <td>{row.telegram_is_bound ? 'Привязан' : 'Не привязан'}</td>
              <td><RowAction onClick={() => setEditor({ kind: 'employee', value: row })} /></td>
            </tr>
          ))}</tbody>
        </table>
      </DirectoryCard>{dialog}</>
    );
  }

  if (section === 'positions') {
    const rows = directory.positions.filter((row) => includesQuery(row.position_name, row.position_description));
    return (
      <><DirectoryCard query={query} onQueryChange={setQuery} count={rows.length} actionLabel="Добавить должность" onAction={() => setEditor({ kind: 'position' })}>
        <table>
          <thead><tr><th>Должность</th><th>Описание</th><th>Тип</th><th>Сотрудников</th><th>Статус</th><th aria-label="Действия" /></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.position_id}>
              <td><strong>{row.position_name}</strong></td>
              <td>{row.position_description ?? '—'}</td>
              <td>{row.is_production_position ? 'Производственная' : 'Административная'}</td>
              <td>{row.employee_count}</td>
              <td><StatusPill active={row.is_active} /></td>
              <td><RowAction onClick={() => setEditor({ kind: 'position', value: row })} /></td>
            </tr>
          ))}</tbody>
        </table>
      </DirectoryCard>{dialog}</>
    );
  }

  if (section === 'machines') {
    const rows = directory.machines.filter((row) => includesQuery(
      row.machine_name,
      row.workshop_name,
      row.machine_status_name,
      row.machine_use_status_name
    ));
    return (
      <>{downloadError && <div className="page-error" role="alert">{downloadError}</div>}<DirectoryCard query={query} onQueryChange={setQuery} count={rows.length} actionLabel="Добавить станок" onAction={() => setEditor({ kind: 'machine' })}>
        <table>
          <thead><tr><th>Станок</th><th>Участок</th><th>Состояние</th><th>Использование</th><th>QR</th><th aria-label="Действия" /></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.machine_id}>
              <td><strong>{row.machine_name}</strong><small className="cell-meta">ID {row.machine_id}</small></td>
              <td>{row.workshop_name ?? '—'}</td>
              <td>{row.machine_status_name}</td>
              <td><StatusPill active={!row.machine_use_is_decommissioned} label={row.machine_use_status_name} /></td>
              <td><div className="qr-cell"><span>{row.qr_is_assigned ? 'Назначен' : 'Не назначен'}</span>{row.qr_is_assigned && <button className="qr-download" type="button" disabled={downloadingQr !== null} onClick={() => downloadQr('MACHINE', row.machine_id)}>{downloadingQr === 'MACHINE:' + row.machine_id ? 'Готовим…' : 'Скачать QR'}</button>}</div></td>
              <td><RowAction onClick={() => setEditor({ kind: 'machine', value: row })} /></td>
            </tr>
          ))}</tbody>
        </table>
      </DirectoryCard>{dialog}</>
    );
  }

  if (section === 'skus') {
    const rows = directory.skus.filter((row) => includesQuery(row.sku_code, row.sku_name, row.sku_unit_name));
    return (
      <>{downloadError && <div className="page-error" role="alert">{downloadError}</div>}<DirectoryCard query={query} onQueryChange={setQuery} count={rows.length} actionLabel="Добавить SKU" onAction={() => setEditor({ kind: 'sku' })}>
        <table>
          <thead><tr><th>SKU</th><th>Наименование</th><th>Ед.</th><th>Производительность/ч</th><th>Тариф</th><th>Статус</th><th>QR</th><th aria-label="Действия" /></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.sku_id}>
              <td><strong>{row.sku_code}</strong></td>
              <td>{row.sku_name ?? '—'}</td>
              <td>{row.sku_unit_name}</td>
              <td>{row.planned_productivity_per_hour ?? 'Не задана'}</td>
              <td>{formatMoney(row.current_sku_tariff_uzs)}</td>
              <td><StatusPill active={row.is_active} /></td>
              <td><div className="qr-cell"><span>{row.qr_is_assigned ? 'Назначен' : 'Не назначен'}</span>{row.qr_is_assigned && <button className="qr-download" type="button" disabled={downloadingQr !== null} onClick={() => downloadQr('SKU', row.sku_id)}>{downloadingQr === 'SKU:' + row.sku_id ? 'Готовим…' : 'Скачать QR'}</button>}</div></td>
              <td><RowAction onClick={() => setEditor({ kind: 'sku', value: row })} /></td>
            </tr>
          ))}</tbody>
        </table>
      </DirectoryCard>{dialog}</>
    );
  }

  if (section === 'work-types') {
    const rows = directory.additional_work_types.filter((row) => includesQuery(row.additional_work_type_name));
    return (
      <><DirectoryCard query={query} onQueryChange={setQuery} count={rows.length} actionLabel="Добавить вид работы" onAction={() => setEditor({ kind: 'additional-work-type' })}>
        <table>
          <thead><tr><th>Вид дополнительной работы</th><th>Идентификатор</th><th>Статус</th><th aria-label="Действия" /></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.additional_work_type_id}>
              <td><strong>{row.additional_work_type_name}</strong></td>
              <td>{row.additional_work_type_id}</td>
              <td><StatusPill active={row.is_active} /></td>
              <td><RowAction onClick={() => setEditor({ kind: 'additional-work-type', value: row })} /></td>
            </tr>
          ))}</tbody>
        </table>
      </DirectoryCard>{dialog}</>
    );
  }

  if (section === 'activities') {
    const rows = directory.activity_types.filter((row) => includesQuery(
      row.display_name,
      row.profile_name,
      activityClassLabel(row.activity_class)
    ));
    const groups = ACTIVITY_CLASS_ORDER.map((activityClass) => {
      const classRows = rows.filter((row) => row.activity_class === activityClass);
      const activeRows = directory.activity_types
        .filter((row) => row.activity_class === activityClass && row.is_active)
        .sort(compareActivityTypes);
      return { activityClass, classRows, activeRows };
    }).filter((group) => group.classRows.length > 0);
    return (
      <>{activityActionError && <div className="page-error" role="alert">{activityActionError}</div>}<DirectoryCard query={query} onQueryChange={setQuery} count={rows.length} actionLabel="Добавить вид" onAction={() => setEditor({ kind: 'activity-type' })}>
        <table className="activity-table">
          <thead><tr><th>Наименование</th><th>Положение</th><th>Профиль</th><th>Статус</th><th aria-label="Действия" /></tr></thead>
          {groups.map(({ activityClass, classRows, activeRows }) => (
            <tbody key={activityClass}>
              <tr className="activity-group-heading">
                <th colSpan={5} scope="colgroup">
                  <span>{activityClassLabel(activityClass)}</span>
                  <small>{classRows.length}</small>
                </th>
              </tr>
              {[...classRows].sort(compareActivityTypes).map((row) => {
                const activeIndex = activeRows.findIndex((item) => item.activity_type_id === row.activity_type_id);
                const key = row.activity_class + ':' + row.activity_type_id;
                return (
                  <tr key={key}>
                    <td><strong>{row.display_name}</strong></td>
                    <td>
                      {row.is_active ? (
                        <div className="activity-order-controls" aria-label={'Положение «' + row.display_name + '»'}>
                          <button
                            type="button"
                            aria-label={'Переместить «' + row.display_name + '» выше'}
                            title="Переместить выше"
                            disabled={movingActivity !== null || activeIndex <= 0}
                            onClick={() => void moveActivity(row, 'UP')}
                          >↑</button>
                          <button
                            type="button"
                            aria-label={'Переместить «' + row.display_name + '» ниже'}
                            title="Переместить ниже"
                            disabled={movingActivity !== null || activeIndex < 0 || activeIndex >= activeRows.length - 1}
                            onClick={() => void moveActivity(row, 'DOWN')}
                          >↓</button>
                          {movingActivity === key && <span className="visually-hidden" role="status">Перемещаем</span>}
                        </div>
                      ) : '—'}
                    </td>
                    <td>{row.profile_name}</td>
                    <td><StatusPill active={row.is_active} /></td>
                    <td>{row.is_active && <RowAction label="Отключить" danger onClick={() => setEditor({ kind: 'deactivate-activity-type', value: row })} />}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </DirectoryCard>{dialog}</>
    );
  }

  const rows = directory.audit_events.filter((row) => includesQuery(
    row.action_name,
    row.actor_full_name,
    row.entity_table_name,
    row.reason
  ));
  return (
    <DirectoryCard query={query} onQueryChange={setQuery} count={rows.length}>
      <table>
        <thead><tr><th>Дата</th><th>Действие</th><th>Пользователь</th><th>Объект</th><th>Причина</th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.audit_event_id}>
            <td>{formatAdminDate(row.created_at)}</td>
            <td><strong>{formatAuditAction(row.action_name)}</strong></td>
            <td>{row.actor_full_name}</td>
            <td>{row.entity_table_name} · {row.entity_record_id}</td>
            <td>{row.reason ?? '—'}</td>
          </tr>
        ))}</tbody>
      </table>
    </DirectoryCard>
  );
}

function DirectoryCard({
  query,
  onQueryChange,
  count,
  actionLabel,
  onAction,
  children
}: {
  query: string;
  onQueryChange: (value: string) => void;
  count: number;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="content-card directory-card">
      <div className="directory-toolbar">
        <label className="search-field">
          <span className="visually-hidden">Поиск в разделе</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Поиск по разделу"
          />
        </label>
        <div className="directory-actions">
          <span className="result-count">Записей: {count}</span>
          {actionLabel && onAction && <button className="add-button" type="button" onClick={onAction}>+ {actionLabel}</button>}
        </div>
      </div>
      {count === 0 ? <div className="empty-state">По вашему запросу ничего не найдено.</div> : (
        <div className="table-scroll">{children}</div>
      )}
      <div className="directory-boundary-note">
        Показаны только рабочие поля. Секреты QR, системные флаги и сырые данные аудита скрыты.
      </div>
    </section>
  );
}

function RowAction({ onClick, label = 'Изменить', danger = false }: { onClick: () => void; label?: string; danger?: boolean }) {
  return <button className={'row-action' + (danger ? ' is-danger' : '')} type="button" onClick={onClick}>{label}</button>;
}

function StatusPill({ active, label }: { active: boolean; label?: string }) {
  return <span className={'status-pill ' + (active ? 'is-active' : 'is-inactive')}>{label ?? (active ? 'Активен' : 'Неактивен')}</span>;
}

function DirectorySkeleton() {
  return (
    <div className="skeleton-stack" aria-live="polite" aria-label="Загрузка справочника">
      <div className="skeleton-block large" />
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="skeleton-stack" aria-live="polite" aria-label="Загрузка обзора">
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((item) => <span key={item} />)}
      </div>
      <div className="skeleton-block" />
      <div className="skeleton-block large" />
    </div>
  );
}

type NavIconKind = 'overview' | 'people' | 'roles' | 'machine' | 'sku' | 'work' | 'pause' | 'audit' | 'session';
type AdminSection = 'overview' | 'employees' | 'positions' | 'machines' | 'skus' | 'work-types' | 'activities' | 'audit';

const ADMIN_SECTIONS: Array<{ id: AdminSection; icon: NavIconKind; label: string }> = [
  { id: 'overview', icon: 'overview', label: 'Обзор' },
  { id: 'employees', icon: 'people', label: 'Сотрудники' },
  { id: 'positions', icon: 'roles', label: 'Должности' },
  { id: 'machines', icon: 'machine', label: 'Станки' },
  { id: 'skus', icon: 'sku', label: 'SKU' },
  { id: 'work-types', icon: 'work', label: 'Виды работ' },
  { id: 'activities', icon: 'pause', label: 'Перерывы и простои' },
  { id: 'audit', icon: 'audit', label: 'Аудит' }
];

const SECTION_COPY: Record<AdminSection, { title: string; description: string }> = {
  overview: {
    title: 'Обзор системы',
    description: 'Актуальное состояние справочников и требующие внимания данные.'
  },
  employees: {
    title: 'Сотрудники',
    description: 'Учетные данные, должность, активный статус и состояние Telegram-привязки.'
  },
  positions: {
    title: 'Должности',
    description: 'Производственные и административные должности организации.'
  },
  machines: {
    title: 'Станки',
    description: 'Состояние, доступность для использования и наличие назначенного QR.'
  },
  skus: {
    title: 'SKU',
    description: 'Наименования, единицы, производительность, тариф и состояние QR.'
  },
  'work-types': {
    title: 'Виды дополнительных работ',
    description: 'Доступный производству справочник дополнительной работы.'
  },
  activities: {
    title: 'Перерывы и простои',
    description: 'Виды и заранее утвержденные профили поведения без изменения системных правил.'
  },
  audit: {
    title: 'Журнал действий',
    description: 'Последние 100 действий без сырых before/after данных и защищенных значений.'
  }
};

function NavIcon({ kind }: { kind: NavIconKind }) {
  const paths: Record<NavIconKind, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6" /><circle cx="17" cy="9" r="2.3" /><path d="M15.5 15c3.3-.5 5 1.2 5.3 4" /></>,
    roles: <><path d="M5 4h14v5H5z" /><path d="M7 13h10v7H7z" /><path d="M12 9v4" /></>,
    machine: <><path d="M4 9h16v10H4z" /><path d="M7 9V5h5v4" /><circle cx="8" cy="14" r="1.5" /><path d="M13 14h4M13 17h4" /></>,
    sku: <><path d="M4 7l8-4 8 4-8 4z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
    work: <><path d="M8 5h8M9 3h6v4H9z" /><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M4 12h16" /></>,
    pause: <><circle cx="12" cy="12" r="9" /><path d="M9 8v8M15 8v8" /></>,
    audit: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 11h6M9 15h6" /></>,
    session: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>
  };
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[kind]}
    </svg>
  );
}

function SecurityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.7-2.5 8.2-7 10-4.5-1.8-7-5.3-7-10V6z" />
      <path d="M9 12l2 2 4-5" />
    </svg>
  );
}

function metricIcon(label: string): NavIconKind {
  if (label === 'Сотрудники') return 'people';
  if (label === 'Станки') return 'machine';
  if (label === 'SKU') return 'sku';
  return 'session';
}

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('ru') ?? '')
    .join('');
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function activityClassLabel(value: ActivityClass): string {
  if (value === 'BREAK') return 'Перерыв';
  if (value === 'OPERATIONAL') return 'Операционный простой';
  return 'Критический простой';
}

const ACTIVITY_CLASS_ORDER: ActivityClass[] = ['BREAK', 'OPERATIONAL', 'CRITICAL'];

function compareActivityTypes(
  left: AdminDirectory['activity_types'][number],
  right: AdminDirectory['activity_types'][number]
): number {
  if (left.is_active !== right.is_active) return left.is_active ? -1 : 1;
  if (left.display_order !== right.display_order) return left.display_order - right.display_order;
  return Number(left.activity_type_id) - Number(right.activity_type_id);
}

function formatMoney(value: string): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 4
  }).format(numericValue) + ' сум';
}

function readErrorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Не удалось выполнить действие';
}
