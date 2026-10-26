import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { projectFileSchema } from '@epd/domain/projectFile';
import { queryKeys } from '@/api/keys';
import { useToast } from '@/components/ui/Toast';
import { useEditorServices } from '@/stores/editor/EditorContext';

/** Opening the draft: resume it, view it read-only, or take it over from another tab. */
export function useDraftActions() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { drafts, presence, workspace } = useEditorServices();

  /** Drops what the start screen knows about the draft, its holder and the recent files. */
  function refresh() {
    for (const queryKey of [queryKeys.draft(), queryKeys.draftHolder(), queryKeys.recentFiles()])
      void queryClient.invalidateQueries({ queryKey });
  }

  /** Reads the draft now (another tab may just have written it) and opens it. */
  async function open(inUse: boolean) {
    const draft = await drafts.get().catch(() => null);
    if (!draft || !projectFileSchema.safeParse(draft.project).success) {
      toast(t('start.draft.invalid'), 'error');
      return;
    }
    workspace.getState().open(
      {
        file: draft.file,
        data: draft.project,
        assets: draft.assets,
        status: draft.savedToFile ? 'saved' : 'draft',
      },
      { inUse },
    );
    refresh();
    navigate('/project/plan');
  }

  return {
    resume: () => open(false),
    /** A read-only view of the draft another tab is editing. */
    openReadOnly: () => open(true),
    /** Makes the tab holding the draft read-only, then edits the draft here. */
    takeOver: async () => {
      await presence.claim();
      await open(false);
    },
    refresh,
  };
}
