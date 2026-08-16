/** Socket / HTTP origin for the multiplayer backend. */
export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://empyrea-game-backend.fly.dev'
      : 'http://localhost:8080');
}
