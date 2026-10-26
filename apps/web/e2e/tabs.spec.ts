import { expect, test } from '@playwright/test';
import { editorState, newProject, start } from './helpers';

// protects=second tab (one draft per browser); fails_when=two tabs can edit and write the same draft, or taking over loses the first tab's last change; no_claim=tabs of different browsers or profiles (separate drafts)
test('a second tab takes the project over and the first turns read-only', async ({ context }) => {
  const first = await context.newPage();
  await start(first);
  await newProject(first, 'Two tabs');
  await first.getByRole('button', { name: 'Add floor' }).click();

  const second = await context.newPage();
  await start(second);
  const draft = second.getByRole('region', { name: 'Draft on this device' });
  await expect(draft).toContainText('Being edited in another tab.');
  await draft.getByRole('button', { name: 'Edit here' }).click();
  await expect(second.getByTestId('project-name')).toHaveText('Two tabs');
  // The floor added in the first tab, maybe not yet autosaved, reached the second one.
  expect(await editorState(second, (s) => s.data.doc.floors.length)).toBe(2);
  expect(await editorState(second, (s) => s.readOnly)).toBe(false);

  await expect(first.getByText(/now being edited in another tab/)).toBeVisible();
  expect(await editorState(first, (s) => s.readOnly)).toBe(true);
});
