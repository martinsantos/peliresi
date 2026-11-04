import { hasConfiguredTransitThreshold } from './alertRuleCondition.service';
import { followupDays } from './alertFollowupPolicy.service';
import { catalogueCondition } from './alertCataloguePolicy.service';

/** Reserved inspection and treatment-follow-up rules use the same event name,
 * but are evaluated by their own jobs and are not transit-duration rules. */
export function transitRuleNeedsThreshold(event: string, condition: string): boolean {
  if (event !== 'TIEMPO_EXCESIVO') return false;
  try {
    if (followupDays(condition) !== null || catalogueCondition(condition) !== null) return false;
    return !hasConfiguredTransitThreshold(condition);
  } catch {
    // Historical malformed rules must not be presented as ready to monitor.
    return true;
  }
}
