/**
 * wordpress-api.ts — API endpoint for WP Importer v4
 *
 * Apenas fornece credenciais + processa categorias/autores.
 * O browser faz todo o trabalho pesado (download imagens, blobs, commit).
 */

import type { APIRoute } from 'astro';
import { validateSession } from '../../../../../lib/auth';
import { readFileFromRepo, writeFileToRepo } from '../../../../../plugins/_server';

export const prerender = false;

function generateSlug(str: string): string {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function checkAuth(request: Request): Promise<boolean> {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => { const [k, ...v] = c.trim().split('='); return [k, decodeURIComponent(v.join('='))]; })
    );
    return validateSession(cookies['admin_session']);
}

export const POST: APIRoute = async ({ request }) => {
    try {
        if (!await checkAuth(request)) {
            return new Response(JSON.stringify({ error: 'Não autorizado' }), {
                status: 401, headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json();
        const action = body.action as string;

        const token = (import.meta.env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? '').trim();
        const owner = (import.meta.env.GITHUB_OWNER ?? process.env.GITHUB_OWNER ?? '').trim();
        const repo  = (import.meta.env.GITHUB_REPO ?? process.env.GITHUB_REPO ?? '').trim();

        // ── GET-CONFIG: retorna credenciais + estado atual ──────────
        if (action === 'get-config') {
            if (!token || !owner || !repo) {
                return ok({
                    error: 'Variáveis GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO não configuradas.',
                });
            }

            // Load current data
            let categories: string[] = [];
            try { const r = await readFileFromRepo('src/data/categories.json'); if (r) categories = JSON.parse(r); } catch {}

            let authors: any[] = [];
            try { const r = await readFileFromRepo('src/data/authors.json'); if (r) authors = JSON.parse(r); } catch {}

            let existingSlugs: string[] = [];
            try { const r = await readFileFromRepo('src/data/post-slugs.json'); if (r) existingSlugs = JSON.parse(r); } catch {}

            return ok({ token, owner, repo, categories, authors, existingSlugs });
        }

        // ── SAVE-META: salva categorias e autores atualizados ───────
        if (action === 'save-meta') {
            const { categories, authors } = body;

            if (categories) {
                await writeFileToRepo('src/data/categories.json', JSON.stringify(categories, null, 2), {
                    message: 'CMS: Import WordPress — categorias',
                });
            }
            if (authors) {
                await writeFileToRepo('src/data/authors.json', JSON.stringify(authors, null, 2), {
                    message: 'CMS: Import WordPress — autores',
                });
            }

            return ok({ saved: true });
        }

        // ── PROXY-IMAGE: baixa imagem no servidor (sem CORS) ────────
        if (action === 'proxy-image') {
            const url = body.url as string;
            if (!url || url.startsWith('data:')) {
                return ok({ error: 'URL inválida' });
            }
            try {
                const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
                if (!res.ok) return ok({ error: `HTTP ${res.status}` });
                const ct = res.headers.get('content-type') || '';
                if (!ct.startsWith('image/')) return ok({ error: 'Não é imagem' });
                const extMap: Record<string, string> = { jpeg: 'jpg', jpg: 'jpg', png: 'png', gif: 'gif', webp: 'webp' };
                const rawExt = ct.split('/')[1]?.split(';')[0]?.trim() || 'jpg';
                const ext = extMap[rawExt] || 'jpg';
                const buf = await res.arrayBuffer();
                const base64 = Buffer.from(buf).toString('base64');
                return ok({ base64, ext });
            } catch (e: any) {
                return ok({ error: e.message || 'Timeout' });
            }
        }

        return new Response(JSON.stringify({ error: 'Ação inválida. Use: get-config, save-meta, proxy-image' }), {
            status: 400, headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[WP Import] Erro:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
};

function ok(data: any) {
    return new Response(JSON.stringify(data), {
        status: 200, headers: { 'Content-Type': 'application/json' },
    });
}
