const REDACTED = '[REDACTED]';
const SAFE_TELEGRAM_WEBHOOK_PATH = `/telegram/bot/webhook/${REDACTED}`;
const TELEGRAM_WEBHOOK_PATH_PATTERN = /\/telegram\/bot\/webhook(?:\/[^/?#\s"'\\]+)?(?:\?[^#\s"'\\]*)?/gi;
const ADMIN_TELEGRAM_QR_TOKEN_PATTERN = /admin_[A-Za-z0-9_-]{43}/g;
const SENSITIVE_HEADER_NAMES = new Set([
  'x-telegram-bot-api-secret-token',
  'x-telegram-init-data',
  'x-admin-csrf-token',
  'authorization',
  'cookie',
  'set-cookie'
]);
const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'current_password',
  'new_password',
  'password_hash',
  'session_token',
  'session_token_hash',
  'csrf_token',
  'csrf_token_hash',
  'confirmation_token',
  'confirmation_token_hash',
  'browser_token',
  'browser_token_hash',
  'qr_image_src'
]);

type LogDestination = {
  write(message: string): unknown;
};

type RequestForLogging = {
  id?: string | number;
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  host?: string;
  ip?: string;
  socket?: {
    remotePort?: number;
  };
};

export function createRedactingLogSecurity(destination: LogDestination = process.stdout) {
  const requestSensitiveValues = new Map<string, string[]>();

  return {
    serializers: {
      req(request: RequestForLogging) {
        const requestId = request.id === undefined ? undefined : String(request.id);
        const sensitiveValues = collectHeaderValues(request.headers);
        const acceptVersion = request.headers?.['accept-version'];
        if (requestId !== undefined && sensitiveValues.length > 0) {
          requestSensitiveValues.set(requestId, sensitiveValues);
        }

        return {
          method: request.method,
          url: redactText(request.url ?? '', sensitiveValues),
          version: typeof acceptVersion === 'string' ? acceptVersion : undefined,
          host: request.host,
          remoteAddress: request.ip,
          remotePort: request.socket?.remotePort,
          headers: redactSensitiveHeaders(request.headers)
        };
      }
    },
    stream: {
      write(message: string) {
        destination.write(redactSerializedLog(message, requestSensitiveValues));
      }
    }
  };
}

export function redactSerializedLogLine(message: string): string {
  return redactSerializedLog(message, new Map());
}

function redactSerializedLog(message: string, requestSensitiveValues: Map<string, string[]>): string {
  return message
    .split('\n')
    .map((line) => redactLine(line, requestSensitiveValues))
    .join('\n');
}

function redactLine(line: string, requestSensitiveValues: Map<string, string[]>): string {
  if (line.length === 0) {
    return line;
  }

  try {
    const parsed = JSON.parse(line) as unknown;
    const requestId = readRequestId(parsed);
    const values = [
      ...(requestId === undefined ? [] : (requestSensitiveValues.get(requestId) ?? [])),
      ...collectSensitiveValues(parsed)
    ];
    const redacted = redactValue(parsed, unique(values));

    if (requestId !== undefined && isTerminalRequestLog(parsed)) {
      requestSensitiveValues.delete(requestId);
    }

    return JSON.stringify(redacted);
  } catch {
    return redactText(line, []);
  }
}

function readRequestId(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const requestId = value.reqId;
  return typeof requestId === 'string' || typeof requestId === 'number'
    ? String(requestId)
    : undefined;
}

function isTerminalRequestLog(value: unknown): boolean {
  if (!isRecord(value) || typeof value.msg !== 'string') {
    return false;
  }

  return value.msg === 'request completed' || value.msg === 'request errored';
}

function collectHeaderValues(headers: RequestForLogging['headers']): string[] {
  if (headers === undefined) {
    return [];
  }

  return Object.entries(headers).flatMap(([name, value]) =>
    isSensitiveHeader(name) ? stringValues(value) : []
  );
}

function redactSensitiveHeaders(
  headers: RequestForLogging['headers']
): Record<string, typeof REDACTED> | undefined {
  if (headers === undefined) {
    return undefined;
  }

  const redacted = Object.fromEntries(
    Object.keys(headers)
      .filter((name) => isSensitiveHeader(name))
      .map((name) => [name, REDACTED] as const)
  );

  return Object.keys(redacted).length > 0 ? redacted : undefined;
}

function collectSensitiveValues(value: unknown, key?: string): string[] {
  if (key !== undefined && isSensitiveKey(key)) {
    return stringValues(value);
  }

  if (key?.toLowerCase() === 'rawheaders' && Array.isArray(value)) {
    return collectRawHeaderValues(value);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectSensitiveValues(item));
  }

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([entryKey, entryValue]) =>
      collectSensitiveValues(entryValue, entryKey)
    );
  }

  return [];
}

function collectRawHeaderValues(rawHeaders: unknown[]): string[] {
  const values: string[] = [];
  for (let index = 0; index + 1 < rawHeaders.length; index += 2) {
    const name = rawHeaders[index];
    if (typeof name === 'string' && isSensitiveHeader(name)) {
      values.push(...stringValues(rawHeaders[index + 1]));
    }
  }
  return values;
}

function redactValue(value: unknown, sensitiveValues: string[], key?: string): unknown {
  if (key !== undefined && isSensitiveKey(key)) {
    return REDACTED;
  }

  if (key?.toLowerCase() === 'rawheaders' && Array.isArray(value)) {
    return redactRawHeaders(value, sensitiveValues);
  }

  if (typeof value === 'string') {
    return redactText(value, sensitiveValues);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, sensitiveValues));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, sensitiveValues, entryKey)
      ])
    );
  }

  return value;
}

function redactRawHeaders(rawHeaders: unknown[], sensitiveValues: string[]): unknown[] {
  const redacted = rawHeaders.map((value) => redactValue(value, sensitiveValues));
  for (let index = 0; index + 1 < rawHeaders.length; index += 2) {
    const name = rawHeaders[index];
    if (typeof name === 'string' && isSensitiveHeader(name)) {
      redacted[index + 1] = REDACTED;
    }
  }
  return redacted;
}

function redactText(value: string, sensitiveValues: string[]): string {
  let redacted = value
    .replace(TELEGRAM_WEBHOOK_PATH_PATTERN, SAFE_TELEGRAM_WEBHOOK_PATH)
    .replace(ADMIN_TELEGRAM_QR_TOKEN_PATTERN, `admin_${REDACTED}`);

  for (const sensitiveValue of sensitiveValues.sort((left, right) => right.length - left.length)) {
    if (sensitiveValue.length > 0 && sensitiveValue !== REDACTED) {
      redacted = redacted.split(sensitiveValue).join(REDACTED);
    }
  }

  for (const sensitiveName of [...SENSITIVE_HEADER_NAMES, ...SENSITIVE_FIELD_NAMES]) {
    const pattern = new RegExp(
      `(${escapeRegExp(sensitiveName)}\\s*[:=]\\s*)(?:"[^"]*"|'[^']*'|[^\\s,;]+)`,
      'gi'
    );
    redacted = redacted.replace(pattern, `$1${REDACTED}`);
  }

  return redacted;
}

function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADER_NAMES.has(name.toLowerCase());
}

function isSensitiveKey(name: string): boolean {
  const normalized = name.toLowerCase();
  return SENSITIVE_HEADER_NAMES.has(normalized) || SENSITIVE_FIELD_NAMES.has(normalized);
}

function stringValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
