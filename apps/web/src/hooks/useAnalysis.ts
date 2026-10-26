import { useMemo } from 'react';
import { computeBom, type BomLine } from '@epd/domain/bom';
import { runChecks, type Warning } from '@epd/domain/checks';
import { projectCatalogItems } from '@epd/domain/catalog/lookup';
import { BUILTIN_PREFIX } from '@epd/domain/catalog/types';
import { routeDoc, type RoutingResult } from '@epd/domain/routing';
import { useEditor } from '@/stores/editor/EditorContext';
import { useCatalog } from '@/hooks/useCatalog';
import { useLibrary } from '@/stores/library/useLibrary';

export interface Analysis {
  routing: RoutingResult;
  bom: BomLine[];
  warnings: Warning[];
}

/**
 * Routing, BOM and checks of the open project, recomputed on every document change. BOM and
 * totals read the project's own copies; only check 10 looks at the library, to warn about a
 * copy the library no longer has.
 */
export function useAnalysis(): Analysis {
  const doc = useEditor((s) => s.data.doc);
  const settings = useEditor((s) => s.data.settings);
  const { lookup } = useCatalog();
  const catalogs = useLibrary((s) => s.library.catalogs);
  const inLibrary = useMemo(() => {
    const ids = new Set(projectCatalogItems(catalogs).map((i) => i.id));
    return (id: string) => id.startsWith(BUILTIN_PREFIX) || ids.has(id);
  }, [catalogs]);
  return useMemo(() => {
    const routing = routeDoc(doc, settings);
    return {
      routing,
      bom: computeBom(doc, settings, lookup, routing),
      warnings: runChecks(doc, settings, lookup, routing, inLibrary),
    };
  }, [doc, settings, lookup, inLibrary]);
}
