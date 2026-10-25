import { useTranslation } from 'react-i18next';
import { useRepositories } from '@/data';
import { useEditorContext } from '@/state/EditorContext';
import { downloadBlob, fileSafe } from '@/ui/download';
import { useAnalysis } from '../bom/useAnalysis';
import { useCatalog } from '../catalog/useCatalog';
import { blobToImage, type ImageData } from './pdfKit';
import { buildProjectPdf } from './projectPdf';

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
      const blob = await files.download('backgrounds', floor.background.storagePath);
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
