import { expect, test } from '@playwright/test'

test.describe('Public configurator', () => {
  test('loads the demo-oak-shelf configurator', async ({ page }) => {
    await page.goto('/c/demo-oak-shelf')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  })

  test('shows interactive dimension controls in 3D canvas', async ({ page }) => {
    await page.goto('/c/demo-oak-shelf')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('button[aria-label="Show dimensions"], button[aria-label="Hide dimensions"]')).toBeVisible()
  })

  test('returns 404-ish for unknown slug', async ({ page }) => {
    await page.goto('/c/nonexistent-slug-xyz')
    await expect(page.locator('body')).toContainText(/not found|error|no configurator/i, {
      timeout: 10_000,
    })
  })
})
