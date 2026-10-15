import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiClient } from '../foundation/apiClient';
import { assetUrl } from '../foundation/runtimePaths';
import { confirmSelfBinding, getAuthMe, identifyByVerifiedPhone } from './authApi';
import {
  resolveAuthMeResponse,
  resolveConfirmSelfBindingResponse,
  resolveIdentifyByPhoneError,
  resolveIdentifyByPhoneResponse,
  technicalFailureRoute
} from './authFlow';
import type { AuthenticatedEntrypoint, Section01RouteState } from './authTypes';
import { getTelegramInitDataFromWebApp, requestVerifiedTelegramContact } from './telegramContact';
import './section01.css';

export type Section01AuthAppProps = {
  apiClient?: ApiClient;
  initialRoute?: Section01RouteState;
  onAuthenticated?: (entrypoint: AuthenticatedEntrypoint) => void;
};

export function Section01AuthApp({ apiClient, initialRoute, onAuthenticated }: Section01AuthAppProps) {
  const client = useMemo(() => apiClient ?? new ApiClient({ getTelegramInitData: getTelegramInitDataFromWebApp }), [apiClient]);
  const [route, setRoute] = useState<Section01RouteState>(initialRoute ?? { screenId: 'S01-N01', loading: true });
  const authCheckStarted = useRef(initialRoute !== undefined);

  const applyDecision = useCallback(
    (decision: ReturnType<typeof resolveAuthMeResponse> | ReturnType<typeof resolveConfirmSelfBindingResponse>) => {
      if (decision.kind === 'authenticated') {
        setRoute({ screenId: 'S01-N01', loading: true });
        onAuthenticated?.(decision.entrypoint);
        return;
      }

      setRoute(decision.route);
    },
    [onAuthenticated]
  );

  const runAuthCheck = useCallback(async () => {
    setRoute({ screenId: 'S01-N01', loading: true });

    try {
      const response = await getAuthMe(client);
      applyDecision(resolveAuthMeResponse(response));
    } catch {
      setRoute(technicalFailureRoute());
    }
  }, [applyDecision, client]);

  useEffect(() => {
    if (initialRoute === undefined) return;
    authCheckStarted.current = true;
    setRoute(initialRoute);
  }, [initialRoute]);

  useEffect(() => {
    if (authCheckStarted.current) {
      return;
    }

    authCheckStarted.current = true;
    void runAuthCheck();
  }, [runAuthCheck]);

  const sharePhone = async () => {
    setRoute({ screenId: 'S01-N02', loading: true });

    try {
      await requestVerifiedTelegramContact();
      const response = await identifyByVerifiedPhone(client);
      setRoute(resolveIdentifyByPhoneResponse(response));
    } catch (error) {
      setRoute(resolveIdentifyByPhoneError(error));
    }
  };

  const confirmYes = async (confirmationToken: string, fullName: string) => {
    setRoute({ screenId: 'S01-N03', loading: true, confirmationToken, fullName });

    try {
      const response = await confirmSelfBinding(client, confirmationToken);
      applyDecision(resolveConfirmSelfBindingResponse(response));
    } catch {
      setRoute(technicalFailureRoute());
    }
  };

  const confirmNo = () => {
    setRoute({ screenId: 'S01-N05', loading: false, reason: 'USER_SELECTED_NOT_ME' });
  };

  return (
    <main className="s01-page">
      <section className="s01-screen" aria-label={`Section 01 ${route.screenId}`}>
        <Section01Header />
        <Section01Content route={route} />
        <Section01Actions
          route={route}
          onRetry={runAuthCheck}
          onSharePhone={sharePhone}
          onConfirmYes={confirmYes}
          onConfirmNo={confirmNo}
        />
      </section>
    </main>
  );
}

function Section01Header() {
  return (
    <header className="s01-logo-zone" aria-label="PEAKS">
      <img className="s01-logo" src={assetUrl('assets/brand/peaks_logo.png')} alt="PEAKS" />
    </header>
  );
}

function Section01Content({ route }: { route: Section01RouteState }) {
  if (route.screenId === 'S01-N01') {
    return (
      <section className="s01-auth-content" aria-label="Статус авторизации">
        <div className="s01-auth-illustration" aria-hidden="true">
          <div className="s01-auth-orbit" />
          <div className="s01-auth-core" />
        </div>
        <section className="s01-auth-text-card">
          <h1>Идёт авторизация...</h1>
          <p>Проверяем доступ к приложению</p>
        </section>
      </section>
    );
  }

  if (route.screenId === 'S01-N02') {
    return (
      <section className="s01-auth-content s01-with-action" aria-label="Требуется номер телефона">
        <div className="s01-project-illustration" aria-hidden="true">
          <div className="s01-project-icon s01-phone" />
        </div>
        <section className="s01-auth-text-card">
          <h1 className="s01-dark-title">Для продолжения регистрации требуется предоставить номер телефона.</h1>
          <p className="s01-two-line">Ручной ввод номера недоступен.</p>
        </section>
      </section>
    );
  }

  if (route.screenId === 'S01-N03') {
    return (
      <section className="s01-confirm-content" aria-label="Подтверждение ФИО сотрудника">
        <div className="s01-employee-illustration" aria-hidden="true">
          <div className="s01-doc-card">
            <div className="s01-avatar-head" />
            <div className="s01-avatar-body" />
            <div className="s01-doc-line s01-doc-line-one" />
            <div className="s01-doc-line s01-doc-line-two" />
          </div>
          <div className="s01-shield-check">✓</div>
        </div>
        <h1 className="s01-question">Вы, {route.fullName}?</h1>
      </section>
    );
  }

  if (route.screenId === 'S01-N04') {
    return (
      <section className="s01-auth-content s01-with-action" aria-label="Сервис временно недоступен">
        <div className="s01-project-illustration" aria-hidden="true">
          <div className="s01-project-exclamation" aria-hidden="true">!</div>
        </div>
        <section className="s01-auth-text-card">
          <h1 className="s01-dark-title">Сервис временно недоступен.</h1>
          <p className="s01-two-line">Проверьте интернет-соединение и повторите вход.</p>
        </section>
      </section>
    );
  }

  return (
    <section className="s01-auth-content s01-with-action" aria-label="Вход в систему невозможен">
      <div className="s01-project-illustration" aria-hidden="true">
        <div className="s01-project-x">×</div>
      </div>
      <section className="s01-auth-text-card">
        <h1 className="s01-dark-title">Вход в систему невозможен.</h1>
        <p className="s01-two-line">Обратитесь к начальнику производства или администратору.</p>
      </section>
    </section>
  );
}

function Section01Actions({
  route,
  onRetry,
  onSharePhone,
  onConfirmYes,
  onConfirmNo
}: {
  route: Section01RouteState;
  onRetry: () => Promise<void>;
  onSharePhone: () => Promise<void>;
  onConfirmYes: (confirmationToken: string, fullName: string) => Promise<void>;
  onConfirmNo: () => void;
}) {
  if (route.screenId === 'S01-N01') {
    return null;
  }

  if (route.screenId === 'S01-N02') {
    return (
      <footer className="s01-fixed-actions" aria-label="Действие">
        <ActionButton icon={assetUrl('assets/icons/section01/phone_share.svg')} disabled={route.loading} onClick={onSharePhone}>
          Поделиться номером телефона
        </ActionButton>
      </footer>
    );
  }

  if (route.screenId === 'S01-N03') {
    return (
      <footer className="s01-fixed-actions" aria-label="Действия подтверждения сотрудника">
        <ActionButton
          icon={assetUrl('assets/icons/section01/confirm_employee_yes.svg')}
          disabled={route.loading}
          onClick={() => onConfirmYes(route.confirmationToken, route.fullName)}
          className="s01-yes-button s01-primary-blue"
        >
          Да, это я
        </ActionButton>
        <ActionButton
          icon={assetUrl('assets/icons/section01/confirm_employee_no.svg')}
          disabled={route.loading}
          onClick={onConfirmNo}
          className="s01-no-button s01-outline-blue"
        >
          Нет, это не я
        </ActionButton>
      </footer>
    );
  }

  return (
    <footer className="s01-fixed-actions" aria-label="Действие">
      <ActionButton icon={assetUrl('assets/icons/section01/retry_login.svg')} disabled={route.loading} onClick={onRetry}>
        Повторить вход
      </ActionButton>
    </footer>
  );
}

function ActionButton({
  children,
  disabled,
  icon,
  onClick,
  className = 's01-primary-blue'
}: {
  children: string;
  disabled: boolean;
  icon: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button className={`s01-action-button ${className}`} type="button" disabled={disabled} onClick={onClick}>
      <span className="s01-icon-slot" aria-hidden="true">
        <img className="s01-button-icon" src={icon} alt="" />
      </span>
      <span className="s01-button-label">{children}</span>
    </button>
  );
}
