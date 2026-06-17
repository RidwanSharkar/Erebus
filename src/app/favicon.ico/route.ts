export const dynamic = 'force-static';

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#080814"/>
  <path d="M32 8 48 32 32 56 16 32Z" fill="#7c3aed"/>
  <path d="M32 16 42 32 32 48 22 32Z" fill="#f8fafc"/>
</svg>`;

export function GET() {
  return new Response(faviconSvg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
