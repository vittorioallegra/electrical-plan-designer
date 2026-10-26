import { useTranslation } from 'react-i18next';
import { useRepositories } from '@/lib/repositories/provider';
import { useEditorContext } from '@/stores/editor/EditorContext';
import { downloadBlob, fileSafe } from '@/lib/download';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useCatalog } from '@/api/catalog';
import { blobToImage, type ImageData } from '@/features/exports/utils/pdfKit';
import { buildProjectPdf } from '@/features/exports/utils/projectPdf';

/** Builds and downloads the project detail PDF. Throws when it cannot be built. */
export function useProjectPdfExport(): () => Promise<void> {
  const { t, i18n } = useTranslation();
  const { store } = useEditorContext();
  const { files } = useRepositories();
  const { lookup, profile } = useCatalog();
  const analysis = useAnalysis();
  return async () => {
    const { meta, data } = store.getState();
    const backgrounds = new Map<string, ImageData>();
    for (const floor of data.doc.floors) {
      if (!floor.background) continue;
      const blob = await files.download('backgrounds', floor.background.assetId);
      backgrounds.set(floor.id, await blobToImage(blob));
    }
    const pdf = buildProjectPdf({
      meta,
      doc: data.doc,
      analysis,
      lookup,
      backgrounds,
      businessName: profile?.businessName ?? '',
      t,
      locale: i18n.language === 'it' ? 'it' : 'en',
      now: new Date(),
    });
    downloadBlob(
      new Blob([pdf.bytes()], { type: 'application/pdf' }),
      `${fileSafe(meta.name)}.pdf`,
    );
  };
}
