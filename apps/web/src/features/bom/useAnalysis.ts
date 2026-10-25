import { useMemo } from 'react';
import { computeBom, type BomLine } from '@/domain/bom';
import { runChecks, type Warning } from '@/domain/checks';
import { routeDoc, type RoutingResult } from '@/domain/routing';
import { useEditor } from '@/state/EditorContext';
import { useCatalog } from '../catalog/useCatalog';

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
