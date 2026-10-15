import {
  PresentationFeedbackBlock,
  PresentationScreenTemplate,
  resolveContentFeedback,
  resolveControlFeedback,
} from '../foundation/presentation';
import type {
  PlatformFontDiagnosticCode,
  PlatformFontReadinessState,
} from '../foundation/fontReadiness';
import { assetUrl } from '../foundation/runtimePaths';

export type Section03SystemFeedbackProps = Readonly<{
  diagnosticCode?: PlatformFontDiagnosticCode | null;
  fontReadinessState?: PlatformFontReadinessState;
  kind: 'loading' | 'recoverable-error' | 'terminal-error';
  message: string;
  onRetry?: () => void;
  retryPending?: boolean;
}>;

export function Section03SystemFeedback({
  kind,
  message,
  diagnosticCode = null,
  fontReadinessState,
  onRetry,
  retryPending = false,
}: Section03SystemFeedbackProps) {
  if (message.trim().length === 0) {
    throw new Error('SECTION03_SYSTEM_FEEDBACK_MESSAGE_REQUIRED');
  }
  const presentation = resolveContentFeedback({ kind });
  return (
    <main
      aria-busy={presentation.ariaBusy}
      aria-label={message}
      className="peaks-section03-screen peaks-section03-system-shell"
      data-platform-diagnostic-code={diagnosticCode ?? undefined}
      data-platform-font-readiness-state={fontReadinessState}
      data-feedback-shell="section03"
    >
      <PresentationScreenTemplate
        accessibilityLabel={message}
        activationKey="section03-feedback-shell"
        busy={presentation.ariaBusy}
        header={(
          <div className="peaks-section03-header">
            <img
              alt="PEAKS"
              className="peaks-section03-header__logo"
              src={assetUrl('assets/brand/peaks_logo.png')}
            />
          </div>
        )}
        scroll={[
          <PresentationFeedbackBlock
            key="system-feedback"
            message={message}
            presentation={presentation}
            retryFeedback={kind === 'recoverable-error'
              ? resolveControlFeedback({
                  availability: retryPending ? 'pending' : 'enabled',
                  preserveToneWhenDisabled: true,
                })
              : undefined}
            retryLabel={kind === 'recoverable-error' ? 'Повторить' : undefined}
            onRetry={kind === 'recoverable-error' ? onRetry : undefined}
          />,
        ]}
      />
    </main>
  );
}
