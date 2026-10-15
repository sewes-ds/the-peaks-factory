import { type Dispatch, type SetStateAction } from 'react';

export type PeaksNumericInputKeyboardHiddenField = {
  name: string;
  value: string;
};

export type PeaksNumericInputKeyboardProps = {
  value: string;
  onChange: Dispatch<SetStateAction<string>>;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  hiddenFields?: PeaksNumericInputKeyboardHiddenField[];
};

export function PeaksNumericInputKeyboard({
  value,
  onChange,
  disabled = false,
  placeholder = 'Количество',
  ariaLabel = 'Числовой ввод',
  hiddenFields = []
}: PeaksNumericInputKeyboardProps) {
  const isPlaceholder = value === '';

  return (
    <section className="peaks-numeric-input-keyboard" aria-label={ariaLabel}>
      <div className="peaks-numeric-input-keyboard__display" role="textbox" aria-label={placeholder} aria-live="polite">
        <span
          className={
            isPlaceholder
              ? 'peaks-numeric-input-keyboard__value peaks-numeric-input-keyboard__value--placeholder'
              : 'peaks-numeric-input-keyboard__value'
          }
        >
          {isPlaceholder ? placeholder : value}
        </span>
      </div>

      <section className="peaks-numeric-input-keyboard__keys" aria-label="Цифровая клавиатура">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            className="peaks-numeric-input-keyboard__key"
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => onChange((current) => addNumericDigit(current, digit))}
          >
            {digit}
          </button>
        ))}

        <button
          className="peaks-numeric-input-keyboard__key peaks-numeric-input-keyboard__key--control"
          type="button"
          disabled={disabled}
          onClick={() => onChange((current) => current.slice(0, -1))}
        >
          Удалить<br />символ
        </button>

        <button
          className="peaks-numeric-input-keyboard__key"
          type="button"
          disabled={disabled}
          onClick={() => onChange((current) => addNumericDigit(current, '0'))}
        >
          0
        </button>

        <button
          className="peaks-numeric-input-keyboard__key"
          type="button"
          disabled={disabled}
          onClick={() => onChange(addDecimalSeparator)}
        >
          ,
        </button>
      </section>

      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
    </section>
  );
}

export function isMalformedNumericInput(raw: string): boolean {
  return raw === '' || raw === ',' || raw === '.' || raw.startsWith('-');
}

export function normalizeNumericInputForApi(value: string): string {
  return value.replace(',', '.');
}

function addNumericDigit(current: string, digit: string): string {
  if (!/^[0-9]$/.test(digit)) {
    return current;
  }

  return `${current}${digit}`;
}

function addDecimalSeparator(current: string): string {
  if (current.includes(',') || current.includes('.')) {
    return current;
  }

  return `${current},`;
}
