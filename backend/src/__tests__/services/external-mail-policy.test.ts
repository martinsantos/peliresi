import { expect, it } from 'vitest';
import { externalAlertRecipientAllowed } from '../../services/email-policy';

it.each([
  ['true', 'one@qa.invalid', 'one@qa.invalid', true],
  ['true', ' one@qa.invalid, TWO@qa.invalid ', ' Two@QA.invalid ', true],
  ['', 'one@qa.invalid', 'one@qa.invalid', false],
  ['false', 'one@qa.invalid', 'one@qa.invalid', false],
  ['true', '', 'one@qa.invalid', false],
  ['true', '*@qa.invalid', 'one@qa.invalid', false],
  ['true', 'one@qa.invalid', 'another-one@qa.invalid', false],
  ['true', 'one@qa.invalid', 'one@qa.invalid.evil.invalid', false],
  ['true', 'Name <one@qa.invalid>', 'Name <one@qa.invalid>', false],
  ['true', 'one@qa.invalid\r\nBcc: other@qa.invalid', 'one@qa.invalid\r\nBcc: other@qa.invalid', false],
])('external recipient needs exact individual approval: %s / %s / %s', (enabled, allowlist, email, expected) => {
  expect(externalAlertRecipientAllowed(email as string, {
    EMAIL_EXTERNAL_ALERTS_ENABLED: enabled as string,
    EMAIL_EXTERNAL_ALERTS_ALLOWLIST: allowlist as string,
  })).toBe(expected);
});
