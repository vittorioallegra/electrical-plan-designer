import { useMemo } from 'react';
import { computeBom, type BomLine } from '@epd/domain/bom';
import { runChecks, type Warning } from '@epd/domain/checks';
import { routeDoc, type RoutingResult } from '@epd/domain/routing';
import { useEditor } from '@/stores/editor/EditorContext';
import { useCatalog } from '@/features/catalog/hooks/useCatalog';

export interface Analysis {
  routing: RoutingResult;
  bom: BomLine[];
  warnings: Warning[];
}

/** Routing, BOM and checks of the open project, recomputed on every document change. */
export function useAnalysis(): Analysis {
  const doc = useEditor((s) => s.data.doc);
  const settings = useEditor((s) => s.data.settings);
  const { lookup } = useCatalog();
  return useMemo(() => {
    const routing = routeDoc(doc, settings);
    return {
      routing,
      bom: computeBom(doc, settings, lookup, routing),
      warnings: runChecks(doc, settings, lookup, routing),
    };
  }, [doc, settings, lookup]);
}
