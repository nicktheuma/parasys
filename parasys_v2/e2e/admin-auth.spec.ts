import { expect, test } from '@playwright/test'

test.describe('Admin authentication', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL('**/admin/login')
    await expect(page.locator('h1')).toContainText('Admin')
  })

  test('shows login form', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('rejects invalid credentials', async ({ page }) => {
    await page.goto('/admin/login')
    await page.locator('input[type="password"]').fill('wrong-password-12345')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('body')).toContainText(/failed|invalid|denied/i)
  })

  test('accepts valid email + password login', async ({ page }) => {
    await page.goto('/admin/login')
    await page.locator('input[type="email"]').fill('admin@parasys.local')
    await page.locator('input[type="password"]').fill('admin1234')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/admin')
    await expect(page.locator('body')).not.toContainText(/failed|invalid|denied/i)
  })
})
