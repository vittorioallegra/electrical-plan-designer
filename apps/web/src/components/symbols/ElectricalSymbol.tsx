import { provisionDash, symbolPaths, type SymbolKind } from './symbols';

export function ElectricalSymbol({
  kind,
  size = 24,
  provision = false,
  title,
}: {
  kind: SymbolKind;
  size?: number;
  provision?: boolean;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path
        d={symbolPaths[kind]}
        strokeDasharray={provision ? provisionDash.join(' ') : undefined}
      />
    </svg>
  );
}
