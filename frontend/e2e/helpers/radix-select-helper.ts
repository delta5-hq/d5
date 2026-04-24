import type { Locator, Page } from '@playwright/test'

/**
 * Radix Select interaction helper - handles portal-based option rendering
 *
 * Radix Select renders options via <SelectPrimitive.Portal> to document.body,
 * not within the dialog/component DOM. This helper provides a generalized
 * interaction pattern that works regardless of where the trigger is located.
 */

export interface RadixSelectOptions {
  /**
   * Regex pattern to match the current trigger text (e.g., /stdio|streamable-http/i)
   * Used to locate the correct combobox when multiple selects exist on the page
   */
  triggerTextPattern: RegExp

  /**
   * Text to match in the option list (e.g., "SSH", "stdio")
   * Performs substring match within the open dropdown
   */
  optionText: string

  /**
   * Optional scope to search for the trigger (e.g., dialog locator)
   * Defaults to page if not provided
   * NOTE: Options are ALWAYS in the document.body portal, regardless of scope
   */
  triggerScope?: Locator
}

/**
 * Select an option from a Radix Select dropdown
 *
 * Algorithm:
 * 1. Locate trigger within scope (or page) by matching current text
 * 2. Click trigger to open portal dropdown
 * 3. Target options in the OPEN portal ([data-state="open"])
 * 4. Click the matching option
 *
 * Edge cases handled:
 * - Multiple Radix Selects on page (workflow-scope-selector + dialog selects)
 * - Portal animation overlap (closing portal still in DOM briefly)
 * - Option text collisions (only searches active dropdown)
 * - Page-level vs scoped usage (optional scope parameter)
 */
export async function selectRadixOption(
  page: Page,
  { triggerTextPattern, optionText, triggerScope }: RadixSelectOptions,
): Promise<void> {
  const searchScope = triggerScope ?? page
  const combobox = searchScope.locator('[role="combobox"]').filter({ hasText: triggerTextPattern }).first()

  const count = await combobox.count()
  if (count === 0) {
    throw new Error(
      `Radix Select trigger not found with pattern ${triggerTextPattern} in scope ${triggerScope ? 'dialog' : 'page'}`,
    )
  }

  await combobox.click()

  await page
    .locator('[data-slot="select-content"][data-state="open"]')
    .locator('[role="option"]')
    .filter({ hasText: optionText })
    .first()
    .click()
}
