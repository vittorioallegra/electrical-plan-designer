export const APP_NAME = 'Electrical Plan Designer';

/** Project name and the unsaved marker: `*` before the name on Windows, plain on macOS (which
 * shows the document-edited dot instead). */
export function windowTitle(
  name: string | null,
  unsaved: boolean,
  platform: NodeJS.Platform,
): string {
  if (name === null) return APP_NAME;
  const marker = unsaved && platform !== 'darwin' ? '*' : '';
  return `${marker}${name} - ${APP_NAME}`;
}
