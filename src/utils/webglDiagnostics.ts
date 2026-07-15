/**
 * Tracks WebGL issues and correlates them with multiplayer disconnect events.
 * Exposed on `window.erebusDiagnostics` in dev builds.
 */

export type WebGlIssueKind = 'context_lost' | 'context_restored' | 'console_error';

export interface WebGlIssueRecord {
  kind: WebGlIssueKind;
  at: number;
  detail?: string;
}

export interface DisconnectCorrelationReport {
  disconnectedAt: number;
  reason: string;
  msSinceLastWebGlIssue: number | null;
  lastWebGlIssue: WebGlIssueRecord | null;
  webGlIssueCount: number;
}

const issues: WebGlIssueRecord[] = [];
const MAX_ISSUES = 32;

let lastDisconnectReport: DisconnectCorrelationReport | null = null;
let consoleHookInstalled = false;

const WEBGL_ERROR_RE =
  /GL_INVALID_OPERATION|Vertex buffer is not big enough|glDrawElements|WebGL/i;

function pushIssue(kind: WebGlIssueKind, detail?: string): void {
  const record: WebGlIssueRecord = { kind, at: Date.now(), detail };
  issues.push(record);
  if (issues.length > MAX_ISSUES) issues.shift();

  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn('[erebus:webgl]', kind, detail ?? '');
  }

  if (typeof window !== 'undefined') {
    const win = window as Window & {
      erebusMemStats?: () => Record<string, unknown>;
      erebusGpuAudit?: () => unknown;
    };
    try {
      win.erebusMemStats?.();
    } catch {
      /* non-fatal */
    }
    try {
      win.erebusGpuAudit?.();
    } catch {
      /* non-fatal */
    }
  }
}

function installConsoleWebGlHook(): void {
  if (consoleHookInstalled || typeof console === 'undefined') return;
  consoleHookInstalled = true;

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const text = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
    if (WEBGL_ERROR_RE.test(text)) {
      pushIssue('console_error', text.slice(0, 240));
    }
    originalError(...args);
  };
}

export function recordWebGlContextLost(detail?: string): void {
  installConsoleWebGlHook();
  pushIssue('context_lost', detail);
}

export function recordWebGlContextRestored(detail?: string): void {
  pushIssue('context_restored', detail);
}

export function recordMultiplayerDisconnect(reason: string): DisconnectCorrelationReport {
  installConsoleWebGlHook();
  const disconnectedAt = Date.now();
  const last = issues.length > 0 ? issues[issues.length - 1] : null;
  const report: DisconnectCorrelationReport = {
    disconnectedAt,
    reason,
    msSinceLastWebGlIssue: last ? disconnectedAt - last.at : null,
    lastWebGlIssue: last,
    webGlIssueCount: issues.length,
  };
  lastDisconnectReport = report;

  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn('[erebus:disconnect-correlation]', report);
    if (report.msSinceLastWebGlIssue != null && report.msSinceLastWebGlIssue < 60_000) {
      // eslint-disable-next-line no-console
      console.warn(
        '[erebus:disconnect-correlation] WebGL issue occurred within 60s of disconnect — possible cascade.',
      );
    }
  }

  return report;
}

export function getWebGlIssues(): readonly WebGlIssueRecord[] {
  return issues;
}

export function getLastDisconnectCorrelation(): DisconnectCorrelationReport | null {
  return lastDisconnectReport;
}

export function installWebGlDiagnostics(): void {
  installConsoleWebGlHook();

  if (typeof window === 'undefined') return;

  type ErebusDiagnosticsWindow = Window & {
    erebusDiagnostics?: {
      getIssues: () => readonly WebGlIssueRecord[];
      getLastDisconnect: () => DisconnectCorrelationReport | null;
    };
  };

  const win = window as ErebusDiagnosticsWindow;
  win.erebusDiagnostics = {
    getIssues: getWebGlIssues,
    getLastDisconnect: getLastDisconnectCorrelation,
  };
}

/** Clamp indexed Line draw range to the allocated index buffer. */
export function clampIndexedDrawRange(
  geometry: { index?: { count: number } | null; setDrawRange: (start: number, count: number) => void },
  requestedCount: number,
): number {
  const maxCount = geometry.index?.count ?? 0;
  const safe = Math.max(0, Math.min(requestedCount, maxCount));
  geometry.setDrawRange(0, safe);
  return safe;
}
