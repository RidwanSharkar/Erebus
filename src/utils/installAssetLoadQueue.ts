import { FileLoader } from 'three';

const MAX_CONCURRENT = 4;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 300;

let installed = false;
let active = 0;
const waiting: Array<() => void> = [];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function pump(): void {
  while (active < MAX_CONCURRENT && waiting.length > 0) {
    const next = waiting.shift();
    if (next) next();
  }
}

function runQueued(start: () => void): void {
  if (active < MAX_CONCURRENT) {
    start();
    return;
  }
  waiting.push(start);
}

/**
 * Caps concurrent Three.js FileLoader requests and retries network failures.
 * Import as a side effect before any `useGLTF.preload` / GLB fetch.
 */
export function installAssetLoadQueue(): void {
  if (installed) return;
  installed = true;

  const originalLoad = FileLoader.prototype.load;

  FileLoader.prototype.load = function (
    this: FileLoader,
    url: string,
    onLoad?: (response: string | ArrayBuffer) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): XMLHttpRequest {
    const loader = this;

    const attemptLoad = (): Promise<string | ArrayBuffer> =>
      new Promise((resolve, reject) => {
        originalLoad.call(
          loader,
          url,
          (response: string | ArrayBuffer) => {
            resolve(response);
          },
          onProgress,
          (err: unknown) => {
            reject(err);
          },
        );
      });

    const start = (): void => {
      active += 1;
      void (async () => {
        let lastError: unknown;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const response = await attemptLoad();
            onLoad?.(response);
            return;
          } catch (error) {
            lastError = error;
            if (attempt < MAX_RETRIES) {
              await delay(RETRY_BASE_MS * 2 ** attempt);
            }
          }
        }
        onError?.(lastError);
      })().finally(() => {
        active -= 1;
        pump();
      });
    };

    runQueued(start);
    return undefined as unknown as XMLHttpRequest;
  };
}

installAssetLoadQueue();
