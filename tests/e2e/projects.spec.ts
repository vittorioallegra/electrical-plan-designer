import { expect, test } from '@playwright/test';

// protects=AC 1 sign up → project list on desktop and phone; fails_when=a new user cannot create or see a project; no_claim=editor content
test('sign up, create a project, see it on desktop and at 375 px', async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('e2e-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(/No projects yet/)).toBeVisible();

  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByLabel('Project name').fill('E2E house');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/plan$/);

  await page.goto('/projects');
  await expect(page.getByRole('link', { name: /E2E house/ })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByRole('link', { name: /E2E house/ })).toBeVisible();
});
