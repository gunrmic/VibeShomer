import { test, expect } from '@playwright/test';

const mockGithubResponse = JSON.stringify({
  projectType: 'nextjs',
  language: 'typescript',
  score: { security: 75, performance: 80 },
  issues: [
    {
      id: '1',
      category: 'security',
      severity: 'critical',
      title: 'API key exposed in client code',
      explanation: 'Sensitive API key is visible in browser-accessible code.',
      location: 'app/page.tsx:5',
      badCode: 'const API_KEY = "sk-live-abc123";',
      fix: 'Move to server-side environment variable',
    },
  ],
  summary: 'Critical security issues found.',
});

test.describe('GitHub URL flow', () => {
  test('switches to GitHub tab and shows URL input', async ({ page }) => {
    await page.goto('/');
    const githubTab = page.locator('button.tab', { hasText: 'GITHUB URL' });
    await githubTab.click();

    await expect(page.locator('input[type="url"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    const analyzeBtn = page.locator('button.btn-primary');
    await expect(analyzeBtn).toBeDisabled();
  });

  test('full GitHub scan flow with mocked API', async ({ page }) => {
    await page.route('**/api/github', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: mockGithubResponse,
      });
    });

    await page.goto('/');
    await page.locator('button.tab', { hasText: 'GITHUB URL' }).click();

    // Enter URL
    await page.locator('input[type="url"]').fill('https://github.com/owner/repo');

    // Click analyze
    await page.locator('button.btn-primary').click();

    // Wait for results
    await expect(page.locator('.report')).toBeVisible({ timeout: 10000 });

    // Verify project badge
    await expect(page.locator('.project-badge')).toContainText('NEXTJS');

    // Verify critical issue
    await expect(page.locator('.issue-card')).toBeVisible();
    await expect(page.locator('.severity-badge')).toContainText('CRITICAL');
  });

  test('shows error for invalid GitHub URL', async ({ page }) => {
    await page.route('**/api/github', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid GitHub URL.' }),
      });
    });

    await page.goto('/');
    await page.locator('button.tab', { hasText: 'GITHUB URL' }).click();
    await page.locator('input[type="url"]').fill('not-a-github-url');
    await page.locator('button.btn-primary').click();

    await expect(page.locator('.error-card')).toBeVisible({ timeout: 10000 });
  });
});
