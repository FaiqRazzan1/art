// Proxy server-side same-origin: GET /api/fetch?url=<artikel>
// Tugas: ambil HTML dari server (seperti curl) agar browser tidak kena blokir CORS,
// termasuk situs di belakang Cloudflare yang tidak mengirim header CORS.
// Dipakai otomatis oleh tombol "Ambil & Audit" di index.html (jalur pertama),
// lalu fallback ke fetch langsung + proxy publik bila proxy ini gagal.
const HOST_BLOCK = [
  /^localhost$/i, /^127\./, /^10\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^\[?::1\]?$/, /^0\.0\.0\.0$/,
  /^169\.254\.169\.254$/, /^metadata\.google/i
];

export default async function handler(req, res) {
  const target = ((req.query && req.query.url) || '').trim();
  if (!target || !/^https?:\/\//i.test(target)) {
    return res.status(400).json({ error: 'Parameter "url" wajib diawali http(s).' });
  }
  let u;
  try { u = new URL(target); }
  catch { return res.status(400).json({ error: 'URL tidak valid.' }); }
  if (HOST_BLOCK.some((rx) => rx.test(u.hostname))) {
    return res.status(403).json({ error: 'Host tujuan diblokir demi keamanan server.' });
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch(target, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
      }
    });
    clearTimeout(timer);
    if (!r.ok) return res.status(r.status).json({ error: 'Situs target menjawab HTTP ' + r.status + '.' });
    const ct = r.headers.get('content-type') || '';
    if (!/html/i.test(ct)) return res.status(415).json({ error: 'Target bukan halaman HTML (' + ct + ').' });
    const html = await r.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(html.slice(0, 2000000));
  } catch (e) {
    const msg = e && e.name === 'AbortError' ? 'timeout 25 detik.' : String((e && e.message) || e);
    return res.status(502).json({ error: 'Gagal mengambil situs target: ' + msg });
  }
}
