'use client';

import React, { memo } from 'react';

/**
 * Stable roster keys for memoized scene layers — only change on spawn/despawn/join/leave,
 * not on HP/stagger/position ticks (those live in enemiesRef / playersTransformsRef).
 */
export function buildEntityIdsKey(ids: Iterable<string>): string {
  return Array.from(ids).sort().join(',');
}

/** Generic wrapper so layer subtrees can bail out when roster keys are unchanged. */
export function coopLayerPropsEqual(
  prev: { rosterKey: string },
  next: { rosterKey: string },
): boolean {
  return prev.rosterKey === next.rosterKey;
}

export const CoopLayerShell = memo(function CoopLayerShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
});
