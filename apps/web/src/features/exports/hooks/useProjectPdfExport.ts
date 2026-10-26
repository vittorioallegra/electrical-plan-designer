import { useTranslation } from 'react-i18next';
import { useEditorContext } from '@/stores/editor/EditorContext';
import { fileSafe } from '@/lib/download';
import { exportFilters, useExportFile } from '@/hooks/useExportFile';
import { assetBlob } from '@/lib/projectFile/epd';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useCatalog } from '@/hooks/useCatalog';
import { blobToImage, type ImageData } from '@/features/exports/utils/pdfKit';
import { buildProjectPdf } from '@/features/exports/utils/projectPdf';

/** Builds the project detail PDF and saves it through the save dialog. Throws when it cannot be built. */
export function useProjectPdfExport(): () => Promise<void> {
  const { t, i18n } = useTranslation();
  const { store } = useEditorContext();
  const { lookup, company } = useCatalog();
  const analysis = useAnalysis();
  const exportFile = useExportFile();
  return async () => {
    const { data, assets } = store.getState();
    const { meta } = data;
    const backgrounds = new Map<string, ImageData>();
    for (const floor of data.doc.floors) {
      if (!floor.background) continue;
      const asset = assets.get(floor.background.assetId);
      if (!asset) throw new Error(`missing asset ${floor.background.assetId}`);
      backgrounds.set(floor.id, await blobToImage(assetBlob(asset)));
    }
    const pdf = buildProjectPdf({
      meta,
      doc: data.doc,
      analysis,
      lookup,
      backgrounds,
      businessName: company.businessName,
      t,
      locale: i18n.language === 'it' ? 'it' : 'en',
      now: new Date(),
    });
    await exportFile(
      `${fileSafe(meta.name)}.pdf`,
      new Blob([pdf.bytes()], { type: 'application/pdf' }),
      exportFilters.pdf,
    );
  };
}
