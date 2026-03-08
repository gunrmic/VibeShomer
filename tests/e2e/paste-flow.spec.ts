import { test, expect } from '@playwright/test';

const mockReviewResponse = JSON.stringify({
  projectType: 'generic-js',
  language: 'javascript',
  score: { security: 85, performance: 90 },
  issues: [
    {
      id: '1',
      category: 'security',
      severity: 'warning',
      title: 'Missing input validation',
      explanation: 'User input is not validated before use.',
      location: 'src/handler.ts:15',
      fix: 'Add Zod schema validation',
    },
  ],
  summary: 'Code is mostly secure with minor improvements needed.',
});

test.describe('Paste code flow', () => {
  test('shows paste tab by default with disabled button', async ({ page }) => {
    await page.goto('/');
    const pasteTab = page.locator('button.tab', { hasText: 'PASTE CODE' });
    await expect(pasteTab).toHaveClass(/active/);

    const analyzeBtn = page.locator('button.btn-primary');
    await expect(analyzeBtn).toBeDisabled();
  });

  test('enables button when code is entered and shows detection hint', async ({ page }) => {
    await page.goto('/');
    const textarea = page.locator('textarea');
    await textarea.fill("import express from 'express';\nconst app = express();");

    const analyzeBtn = page.locator('button.btn-primary');
    await expect(analyzeBtn).toBeEnabled();

    const hint = page.locator('.hint');
    await expect(hint).toContainText('Detected:');
  });

  test('full paste scan flow with mocked API', async ({ page }) => {
    // Intercept API call
    await page.route('**/api/review', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: mockReviewResponse,
      });
    });

    await page.goto('/');

    // Enter code
    const textarea = page.locator('textarea');
    await textarea.fill('const x = eval(userInput);');

    // Click analyze
    const analyzeBtn = page.locator('button.btn-primary');
    await analyzeBtn.click();

    // Wait for results to appear
    await expect(page.locator('.report')).toBeVisible({ timeout: 10000 });

    // Verify scores are displayed
    await expect(page.locator('.score-number').first()).toBeVisible();

    // Verify summary
    await expect(page.locator('.summary')).toContainText('mostly secure');

    // Verify issue card is shown
    await expect(page.locator('.issue-card')).toBeVisible();
    await expect(page.locator('.issue-title')).toContainText('Missing input validation');

    // Click "analyze another" to reset
    const resetBtn = page.locator('button', { hasText: 'analyze another' });
    await resetBtn.click();

    // Should be back to input form
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('shows error on API failure', async ({ page }) => {
    await page.route('**/api/review', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Too many requests. Slow down.' }),
      });
    });

    await page.goto('/');
    await page.locator('textarea').fill('const x = 1;');
    await page.locator('button.btn-primary').click();

    await expect(page.locator('.error-card')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.error-card')).toContainText('Too many requests');

    // Click try again
    await page.locator('button', { hasText: 'try again' }).click();
    await expect(page.locator('textarea')).toBeVisible();
  });
});
