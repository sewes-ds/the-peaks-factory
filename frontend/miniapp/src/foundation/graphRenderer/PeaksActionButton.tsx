import { type MouseEventHandler, type ReactNode } from 'react';
import { assetUrl } from '../runtimePaths';

export type PeaksActionButtonVariant =
  | 'primaryBlue'
  | 'lightBlue'
  | 'outlineBlue'
  | 'green'
  | 'yellow'
  | 'gray'
  | 'red';

export type PeaksActionButtonSize = 'main70' | 'fixed55' | 'salary55';

export type PeaksActionButtonProps = {
  variant: PeaksActionButtonVariant;
  icon: string;
  label: ReactNode;
  size?: PeaksActionButtonSize;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  ariaLabel?: string;
  showIcon?: boolean;
};

export function PeaksActionButton({
  variant,
  icon,
  label,
  size = 'main70',
  disabled,
  onClick,
  className,
  ariaLabel,
  showIcon = true
}: PeaksActionButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={[
        'peaks-action-button',
        `peaks-action-button--${variant}`,
        `peaks-action-button--${size}`,
        !showIcon ? 'peaks-action-button--noIcon' : '',
        className || ''
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {showIcon ? (
        <span className="peaks-action-button__icon-slot" aria-hidden="true">
          <img className="peaks-action-button__icon" src={assetUrl(`assets/icons/${icon}`)} alt="" />
        </span>
      ) : null}
      <span className="peaks-action-button__label">{label}</span>
    </button>
  );
}

export type PeaksListButtonVariant = 'blue' | 'green' | 'yellow' | 'gray' | 'red' | 'whiteGray';

export type PeaksListButtonProps = {
  variant?: PeaksListButtonVariant;
  mainLine: ReactNode;
  secondaryLine?: ReactNode;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  ariaLabel?: string;
};

export function PeaksListButton({
  variant = 'blue',
  mainLine,
  secondaryLine,
  disabled,
  onClick,
  className,
  ariaLabel
}: PeaksListButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={['peaks-list-button', `peaks-list-button--${variant}`, className || ''].filter(Boolean).join(' ')}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <span className="peaks-list-button__main">{mainLine}</span>
      {secondaryLine ? <span className="peaks-list-button__secondary">{secondaryLine}</span> : null}
    </button>
  );
}
