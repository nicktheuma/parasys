import { expect, test } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/parasys/i)
  })

  test('404 page for unknown routes', async ({ page }) => {
    await page.goto('/this-does-not-exist')
    await expect(page.locator('body')).toContainText(/not found/i)
  })
})
