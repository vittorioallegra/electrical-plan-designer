// Query keys of the local data the app reads through TanStack Query.
export const queryKeys = {
  recovery: () => ['recovery'] as const,
  backgroundImage: (assetId: string) => ['backgroundImage', assetId] as const,
};
