import type { CheckCatalogItem, TargetKind } from '@osint-pier/contracts';

export function getCompatibleChecks(
  checks: CheckCatalogItem[],
  targetKind: TargetKind | null,
): CheckCatalogItem[] {
  if (!targetKind) return checks;

  return checks.filter((check) =>
    check.supportedTargetKinds.includes(targetKind),
  );
}
