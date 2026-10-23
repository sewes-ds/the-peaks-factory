import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClient } from './foundation/apiClient';
import { getAppEntrypoint, type AppEntrypointResponse } from './foundation/appEntrypoint';
import { Section01AuthApp } from './section01/Section01AuthApp';
import { technicalFailureRoute } from './section01/authFlow';
import type { Section01RouteState } from './section01/authTypes';
import { getTelegramInitDataFromWebApp, notifyTelegramWebAppReady } from './section01/telegramContact';
import {
  getOperatorSalaryState,
  getOperatorWorkplaceState,
  resolveOperatorEntrypointByWorkplaceState,
  startOperatorShift
} from './section02/operatorWorkplace';
import type { OperatorSalaryStateResponse, OperatorWorkplaceStateResponse } from './section02/operatorWorkplace';
import { Section02ShiftNotStarted } from './legacy/section02/Section02ShiftNotStarted';
import { Section02OperatorPipelineHost } from './legacy/section02/Section02OperatorPipelineHost';
import { Section02SalarySummary } from './legacy/section02/Section02SalarySummary';
import { Section02SalaryHistory } from './legacy/section02/Section02SalaryHistory';
import { Section03ManagerGraphHost } from './legacy/section03/Section03ManagerGraphHost';
import { Section03Host } from './section03';
import { Section02Host, resolveSection02InitialNode } from './section02';
import { Section04DirectorPlaceholder } from './section04/Section04DirectorPlaceholder';
import './foundation/peaksTheme.css';
import './foundation/graphRenderer/graphRenderer.css';
import './legacy/section02/section02.css';
import './legacy/section03/section03.css';
import './foundation/graphObjects/graphObjects.css';

type AppRoute =
  | { kind: 'auth'; initialRoute?: Section01RouteState }
  | { kind: 'manager'; entrypoint: AppEntrypointResponse }
  | { kind: 'director'; entrypoint: AppEntrypointResponse }
  | {
      kind: 'operator';
      screenId: 'S02-N01' | 'S02-N02';
      workplaceState?: OperatorWorkplaceStateResponse;
    }
  | {
      kind: 'operator';
      screenId: 'S02-SAL01' | 'S02-SAL02';
      workplaceState?: OperatorWorkplaceStateResponse;
      salaryState: OperatorSalaryStateResponse;
    };

export function App() {
  const apiClient = useMemo(() => new ApiClient({ getTelegramInitData: getTelegramInitDataFromWebApp }), []);
  const section03Selector = useMemo(() => resolveSection03Selector(), []);
  const section02Selector = useMemo(() => resolveSection02Selector(), []);
  const [route, setRoute] = useState<AppRoute>({ kind: 'auth' });
  const [startShiftPending, setStartShiftPending] = useState(false);

  useEffect(() => {
    notifyTelegramWebAppReady();
  }, []);

  const resolvePostAuthRoute = useCallback(async () => {
    try {
      const entrypoint = await getAppEntrypoint(apiClient);

      if (entrypoint.section === 'section04') {
        setRoute({ kind: 'director', entrypoint });
        return;
      }

      if (entrypoint.section === 'section03') {
        setRoute({ kind: 'manager', entrypoint });
        return;
      }

      const workplaceState = await getOperatorWorkplaceState(apiClient);
      setRoute({
        kind: 'operator',
        screenId: resolveOperatorEntrypointByWorkplaceState(workplaceState),
        workplaceState
      });
    } catch {
      setRoute({ kind: 'auth', initialRoute: technicalFailureRoute() });
    }
  }, [apiClient]);

  const startShift = useCallback(async () => {
    if (startShiftPending) {
      return;
    }

    setStartShiftPending(true);

    try {
      await startOperatorShift(apiClient);
      await resolvePostAuthRoute();
    } catch {
      setRoute({ kind: 'auth', initialRoute: technicalFailureRoute() });
    } finally {
      setStartShiftPending(false);
    }
  }, [apiClient, resolvePostAuthRoute, startShiftPending]);

  const handleShiftInactive = useCallback((workplaceState: OperatorWorkplaceStateResponse) => {
    setRoute({
      kind: 'operator',
      screenId: 'S02-N01',
      workplaceState
    });
  }, []);

  const openSalary = useCallback(async () => {
    try {
      const salaryState = await getOperatorSalaryState(apiClient);
      setRoute((currentRoute) => ({
        kind: 'operator',
        screenId: 'S02-SAL01',
        workplaceState: currentRoute.kind === 'operator' ? currentRoute.workplaceState : undefined,
        salaryState
      }));
    } catch {
      setRoute({ kind: 'auth', initialRoute: technicalFailureRoute() });
    }
  }, [apiClient]);

  const openSalaryHistory = useCallback(() => {
    setRoute((currentRoute) =>
      currentRoute.kind === 'operator' && currentRoute.screenId === 'S02-SAL01'
        ? {
            ...currentRoute,
            screenId: 'S02-SAL02'
          }
        : currentRoute
    );
  }, []);

  const backToSalarySummary = useCallback(() => {
    setRoute((currentRoute) =>
      currentRoute.kind === 'operator' && currentRoute.screenId === 'S02-SAL02'
        ? {
            ...currentRoute,
            screenId: 'S02-SAL01'
          }
        : currentRoute
    );
  }, []);

  if (route.kind === 'auth') {
    return (
      <Section01AuthApp
        apiClient={apiClient}
        initialRoute={route.initialRoute}
        onAuthenticated={() => void resolvePostAuthRoute()}
      />
    );
  }

  if (route.kind === 'manager') {
    return resolveSection03ManagerMode(section03Selector) === 'legacy'
      ? <Section03ManagerGraphHost apiClient={apiClient} />
      : <Section03Host apiClient={apiClient} />;
  }

  if (route.kind === 'director') {
    return <Section04DirectorPlaceholder entrypoint={route.entrypoint} />;
  }

  if (section02Selector !== 'legacy' && route.workplaceState) {
    return (
      <Section02Host
        apiClient={apiClient}
        initialNodeId={resolveSection02InitialNode(route.workplaceState)}
      />
    );
  }

  if (route.screenId === 'S02-SAL01') {
    return (
      <Section02SalarySummary
        salary={route.salaryState}
        onOpenHistory={openSalaryHistory}
        onBack={() => void resolvePostAuthRoute()}
      />
    );
  }

  if (route.screenId === 'S02-SAL02') {
    return <Section02SalaryHistory salary={route.salaryState} onBack={backToSalarySummary} />;
  }

  if (route.screenId === 'S02-N01') {
    return (
      <Section02ShiftNotStarted
        onStartShift={() => void startShift()}
        startShiftPending={startShiftPending}
        onOpenSalary={() => void openSalary()}
      />
    );
  }

  if (route.screenId === 'S02-N02' && route.workplaceState) {
    return (
      <Section02OperatorPipelineHost
        apiClient={apiClient}
        initialWorkplaceState={route.workplaceState}
        onUnavailable={() => setRoute({ kind: 'auth', initialRoute: technicalFailureRoute() })}
        onShiftInactive={handleShiftInactive}
        onOpenSalary={() => void openSalary()}
      />
    );
  }

  return <Section01AuthApp apiClient={apiClient} initialRoute={technicalFailureRoute()} />;
}


export type Section03SelectorResult = 'legacy' | null;
export type Section03ManagerMode = 'legacy' | 'main';

export function resolveSection03ManagerMode(selector: Section03SelectorResult): Section03ManagerMode {
  return selector === 'legacy' ? 'legacy' : 'main';
}

export function resolveSection03SelectorFromLocation(input: Readonly<{ search: string; hash: string }>): Section03SelectorResult {
  const params = new URLSearchParams(input.search);
  const section03Values = params.getAll('section03');

  if (section03Values.includes('legacy')) {
    return 'legacy';
  }

  return null;
}

function resolveSection03Selector(): Section03SelectorResult {
  if (typeof window === 'undefined') {
    return null;
  }

  return resolveSection03SelectorFromLocation({ search: window.location.search, hash: window.location.hash });
}

export type Section02SelectorResult = 'legacy' | null;

export function resolveSection02SelectorFromLocation(input: Readonly<{ search: string }>): Section02SelectorResult {
  const values = new URLSearchParams(input.search).getAll('section02');
  return values.includes('legacy') ? 'legacy' : null;
}

function resolveSection02Selector(): Section02SelectorResult {
  if (typeof window === 'undefined') return null;
  return resolveSection02SelectorFromLocation({ search: window.location.search });
}
