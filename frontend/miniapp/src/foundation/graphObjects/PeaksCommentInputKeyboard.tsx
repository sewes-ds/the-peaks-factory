import { useState, type Dispatch, type SetStateAction } from 'react';

export type PeaksCommentInputKeyboardProps = {
  value: string;
  onChange: Dispatch<SetStateAction<string>>;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  name?: string;
  minRows?: number;
  maxLength?: number;
  helperText?: string;
};

type KeySpec =
  | { kind: 'key'; value: string; label: string }
  | { kind: 'shift'; label: string }
  | { kind: 'backspace'; label: string }
  | { kind: 'space'; label: string };

const COMMENT_KEY_ROWS: KeySpec[][] = [
  [
    key('1'),
    key('2'),
    key('3'),
    key('4'),
    key('5'),
    key('6'),
    key('7'),
    key('8'),
    key('9'),
    key('0')
  ],
  [
    key('й', 'Й'),
    key('ц', 'Ц'),
    key('у', 'У'),
    key('к', 'К'),
    key('е', 'Е'),
    key('н', 'Н'),
    key('г', 'Г'),
    key('ш', 'Ш'),
    key('щ', 'Щ'),
    key('з', 'З'),
    key('х', 'Х')
  ],
  [
    key('ф', 'Ф'),
    key('ы', 'Ы'),
    key('в', 'В'),
    key('а', 'А'),
    key('п', 'П'),
    key('р', 'Р'),
    key('о', 'О'),
    key('л', 'Л'),
    key('д', 'Д'),
    key('ж', 'Ж'),
    key('э', 'Э')
  ],
  [
    { kind: 'shift', label: '⇧' },
    key('я', 'Я'),
    key('ч', 'Ч'),
    key('с', 'С'),
    key('м', 'М'),
    key('и', 'И'),
    key('т', 'Т'),
    key('ь', 'Ь'),
    key('б', 'Б'),
    key('ю', 'Ю'),
    { kind: 'backspace', label: '⌫' }
  ],
  [key(',', ','), { kind: 'space', label: 'Пробел' }, key('.', '.')]
];

export function PeaksCommentInputKeyboard({
  value,
  onChange,
  disabled = false,
  placeholder = '{comment}',
  ariaLabel = 'Комментарий',
  name = 'comment',
  maxLength,
  helperText
}: PeaksCommentInputKeyboardProps) {
  const [shiftEnabled, setShiftEnabled] = useState(false);
  const hasValue = value.length > 0;

  return (
    <section className="peaks-comment-input-keyboard" aria-label={ariaLabel}>
      <div
        className={`peaks-comment-input-keyboard__field comment-field comment-input-field${
          hasValue ? '' : ' is-placeholder'
        }`}
        role="textbox"
        aria-label={ariaLabel}
        aria-readonly="true"
        data-comment-display
        data-placeholder={placeholder}
      >
        {hasValue ? value : placeholder}
      </div>

      <textarea
        aria-hidden="true"
        className="peaks-comment-input-keyboard__native-bridge"
        data-native-keyboard="disabled"
        inputMode="none"
        name={name}
        readOnly
        tabIndex={-1}
        value={value}
        onFocus={(event) => event.currentTarget.blur()}
        onInput={(event) => onChange(event.currentTarget.value)}
        onChange={(event) => onChange(event.target.value)}
      />

      <section className="keyboard-placeholder inline-keyboard" aria-label="Встроенная русская клавиатура">
        {COMMENT_KEY_ROWS.map((row, rowIndex) => (
          <div
            className={`keyboard-row ${
              rowIndex === 0 ? 'keyboard-row-digits' : rowIndex < 4 ? 'keyboard-row-letters' : 'keyboard-row-bottom'
            }`}
            key={`comment-key-row-${rowIndex}`}
          >
            {row.map((item) => renderKey(item, shiftEnabled, setShiftEnabled, onChange, disabled, maxLength))}
          </div>
        ))}
      </section>

      {helperText ? <div className="peaks-comment-input-keyboard__helper">{helperText}</div> : null}
    </section>
  );
}

export function isEmptyCommentInput(value: string): boolean {
  return value.trim().length === 0;
}

function key(value: string, label = value): KeySpec {
  return { kind: 'key', value, label };
}

function renderKey(
  item: KeySpec,
  shiftEnabled: boolean,
  setShiftEnabled: Dispatch<SetStateAction<boolean>>,
  onChange: Dispatch<SetStateAction<string>>,
  disabled: boolean,
  maxLength?: number
) {
  if (item.kind === 'shift') {
    return (
      <button
        className={`keyboard-key keyboard-shift${shiftEnabled ? ' is-active' : ''}`}
        data-shift="toggle"
        disabled={disabled}
        key="shift"
        type="button"
        onClick={() => setShiftEnabled((current) => !current)}
      >
        {item.label}
      </button>
    );
  }

  if (item.kind === 'backspace') {
    return (
      <button
        className="keyboard-key keyboard-backspace"
        data-action="backspace"
        disabled={disabled}
        key="backspace"
        type="button"
        onClick={() => onChange((current) => current.slice(0, -1))}
      >
        {item.label}
      </button>
    );
  }

  if (item.kind === 'space') {
    return (
      <button
        className="keyboard-key keyboard-space"
        data-action="space"
        disabled={disabled}
        key="space"
        type="button"
        onClick={() => onChange((current) => appendCommentText(current, ' ', maxLength))}
      >
        {item.label}
      </button>
    );
  }

  const value = shiftEnabled && isRussianLetter(item.value) ? item.value.toUpperCase() : item.value;
  const className =
    item.value === ',' ? 'keyboard-key keyboard-symbols' : item.value === '.' ? 'keyboard-key keyboard-dot' : 'keyboard-key';

  return (
    <button
      className={className}
      data-key={item.value}
      disabled={disabled}
      key={item.value}
      type="button"
      onClick={() => onChange((current) => appendCommentText(current, value, maxLength))}
    >
      {item.label}
    </button>
  );
}

function appendCommentText(current: string, value: string, maxLength?: number): string {
  const next = `${current}${value}`;

  if (typeof maxLength !== 'number') {
    return next;
  }

  return next.slice(0, maxLength);
}

function isRussianLetter(value: string): boolean {
  return /^[а-яё]$/iu.test(value);
}
