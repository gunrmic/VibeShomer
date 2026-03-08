import { test, expect } from '@playwright/test';

const mockReviewResponse = JSON.stringify({
  projectType: 'nextjs',
  language: 'typescript',
  score: { security: 80, performance: 85 },
  issues: [
    {
      id: '1',
      category: 'security',
      severity: 'warning',
      title: 'Missing CSRF protection',
      explanation: 'Form submissions lack CSRF tokens.',
    },
  ],
  summary: 'Minor security improvements needed.',
});

test.describe('PDF export', () => {
  test('downloads PDF report from results page', async ({ page }) => {
    // Mock the review API
    await page.route('**/api/review', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: mockReviewResponse,
      });
    });

    // Mock the PDF API
    await page.route('**/api/pdf/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 mock pdf content'),
        headers: {
          'Content-Disposition': 'attachment; filename="vibeshomer-report.pdf"',
        },
      });
    });

    // Navigate and submit code
    await page.goto('/');
    await page.locator('textarea').fill('const x = 1;');
    await page.locator('button.btn-primary').click();

    // Wait for results
    await expect(page.locator('.report')).toBeVisible({ timeout: 10000 });

    // Click download and expect a download event
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button.btn-export').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('vibeshomer-report');
  });
});
