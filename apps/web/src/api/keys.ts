// Query keys of the local data the app reads through TanStack Query.
export const queryKeys = {
  draft: () => ['draft'] as const,
  draftHolder: () => ['draftHolder'] as const,
  recentFiles: () => ['recentFiles'] as const,
  backgroundImage: (assetId: string) => ['backgroundImage', assetId] as const,
};
