/** File-system safe name from a project name. */
export function fileSafe(name: string): string {
  return name.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'project';
}
