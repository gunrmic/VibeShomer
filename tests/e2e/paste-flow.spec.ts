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
    await expect(page.getByRole('button', { name: 'PASTE CODE' })).toHaveClass(/active/);
    await expect(page.getByRole('button', { name: 'analyze code' })).toBeDisabled();
  });

  test('enables button when code is entered and shows detection hint', async ({ page }) => {
    await page.goto('/');
    const textarea = page.getByPlaceholder('Paste your code here...');
    await textarea.click();
    await textarea.pressSequentially("import express from 'express';", { delay: 10 });

    await expect(page.getByRole('button', { name: 'analyze code' })).toBeEnabled();
    await expect(page.locator('.hint')).toContainText('Detected:');
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
    const textarea = page.getByPlaceholder('Paste your code here...');
    await textarea.click();
    await textarea.pressSequentially('const x = eval(userInput);', { delay: 10 });

    // Click analyze
    await page.getByRole('button', { name: 'analyze code' }).click();

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
    await page.getByRole('button', { name: 'analyze another' }).click();

    // Should be back to input form
    await expect(page.getByPlaceholder('Paste your code here...')).toBeVisible();
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
    const textarea = page.getByPlaceholder('Paste your code here...');
    await textarea.click();
    await textarea.pressSequentially('const x = 1;', { delay: 10 });
    await page.getByRole('button', { name: 'analyze code' }).click();

    await expect(page.locator('.error-card')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.error-card')).toContainText('Too many requests');

    // Click try again
    await page.getByRole('button', { name: 'try again' }).click();
    await expect(page.getByPlaceholder('Paste your code here...')).toBeVisible();
  });
});
