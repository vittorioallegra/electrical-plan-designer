import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = new URL('../..', import.meta.url).pathname;
const eslint = new ESLint({ cwd: repoRoot });

/** Rule ids reported for `code` as if it lived at `filePath` (relative to the repo root). */
async function rulesFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? m.message);
}

describe('import boundaries', () => {
  // protects=feature isolation; fails_when=a feature can import another feature; no_claim=runtime behavior
  it('rejects a feature importing another feature', async () => {
    const rules = await rulesFor(
      'apps/web/src/features/bom/components/Probe.tsx',
      "import { PlanView } from '@/features/editor/components/PlanView';\nexport const x = PlanView;\n",
    );
    expect(rules).toContain('import-x/no-restricted-paths');
  });

  // protects=feature isolation with relative paths; fails_when=a relative path escapes the rule; no_claim=other features
  it('rejects a relative import into another feature', async () => {
    const rules = await rulesFor(
      'apps/web/src/features/bom/components/Probe.tsx',
      "import { PlanView } from '../../editor/components/PlanView';\nexport const x = PlanView;\n",
    );
    expect(rules).toContain('import-x/no-restricted-paths');
  });

  // protects=shared layer direction; fails_when=shared hooks can import a feature or the app; no_claim=other shared folders
  it('rejects shared code importing a feature or the app', async () => {
    const fromFeature = await rulesFor(
      'apps/web/src/hooks/probe.ts',
      "import { BomTab } from '@/features/bom/components/BomTab';\nexport const x = BomTab;\n",
    );
    const fromApp = await rulesFor(
      'apps/web/src/lib/probe.ts',
      "import { routes } from '@/app/router';\nexport const x = routes;\n",
    );
    expect(fromFeature).toContain('import-x/no-restricted-paths');
    expect(fromApp).toContain('import-x/no-restricted-paths');
  });

  // protects=no barrels; fails_when=index.ts re-exports are allowed; no_claim=index files with own code
  it('rejects re-export barrels in index files', async () => {
    const rules = await rulesFor('apps/web/src/lib/probe/index.ts', "export * from '../format';\n");
    expect(rules).toContain('no-restricted-syntax');
  });

  // protects=rule precision; fails_when=allowed imports are reported; no_claim=every allowed pair
  it('allows features to import shared code and the app to compose features', async () => {
    const feature = await rulesFor(
      'apps/web/src/features/bom/components/Probe.tsx',
      "import { cn } from '@/lib/cn';\nimport { Checklist } from './Checklist';\nexport const x = [cn, Checklist];\n",
    );
    const app = await rulesFor(
      'apps/web/src/app/routes/probe.tsx',
      "import { PlanView } from '@/features/editor/components/PlanView';\nexport const x = PlanView;\n",
    );
    expect(feature).toEqual([]);
    expect(app).toEqual([]);
  });
});
