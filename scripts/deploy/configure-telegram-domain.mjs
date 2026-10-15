#!/usr/bin/env node

import { applyTelegramDomain, inspectTelegramDomain } from './telegram-domain-tools.mjs';

async function main() {
  const [action, rollbackOption, rollbackPublicBaseUrl] = process.argv.slice(2);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (action === '--inspect' && rollbackOption === undefined) {
    const result = await inspectTelegramDomain({ botToken });
    process.stdout.write(
      `TELEGRAM_DOMAIN_INSPECT_PASS webhook_configured=${result.webhookConfigured} `
      + `pending_updates=${result.pendingUpdateCount ?? 'unknown'} last_error=${result.lastErrorPresent}\n`
    );
    return;
  }

  if (
    action !== '--apply'
    || rollbackOption !== '--rollback-public-base-url'
    || !rollbackPublicBaseUrl
    || process.env.PEAKS_TELEGRAM_DOMAIN_CHANGE !== 'CONFIRMED'
  ) {
    throw new Error(
      'Apply requires --apply --rollback-public-base-url <URL> and PEAKS_TELEGRAM_DOMAIN_CHANGE=CONFIRMED'
    );
  }

  const result = await applyTelegramDomain({
    botToken,
    webhookSecretToken: process.env.TELEGRAM_BOT_WEBHOOK_SECRET_TOKEN,
    webhookPathSecret: process.env.TELEGRAM_BOT_WEBHOOK_PATH_SECRET,
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
    rollbackPublicBaseUrl
  });
  process.stdout.write(
    `TELEGRAM_DOMAIN_APPLY_PASS domain=${result.domain} `
    + `pending_updates=${result.pendingUpdateCount ?? 'unknown'} last_error=${result.lastErrorPresent}\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `TELEGRAM_DOMAIN_CHANGE_FAIL: ${error instanceof Error ? error.message : 'unknown error'}\n`
  );
  process.exitCode = 1;
});
