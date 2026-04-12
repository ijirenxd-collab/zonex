/**
 * ImportPage.tsx — WP Importer v4
 *
 * Tudo roda no browser:
 *   1. Parseia XML com DOMParser
 *   2. Processa posts (serializa MD, baixa imagens)
 *   3. Cria blobs no GitHub API
 *   4. Faz 1 commit via Trees API
 *
 * O servidor só fornece credenciais e salva categorias/autores.
 */

import { useState, useRef } from 'react';
import { Upload, Loader2, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { triggerToast } from '../../components/admin/CmsToaster';

interface ImportResult {
    success: boolean;
    posts: { imported: number; skipped: number; errors: string[]; imagesImported: number };
    authors: { imported: number; skipped: number };
    categories: { imported: number; skipped: number };
    errors: string[];
}

interface ParsedPost {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    status: string;
    creator: string;
    postDate: string;
    category: string;
    thumbnailUrl: string;
    imageUrls: string[];
}

// ── XML helpers ─────────────────────────────────────────────────────────────

function getWpText(item: Element, tag: string): string {
    let el = item.getElementsByTagName(tag)[0];
    if (el) return el.textContent?.trim() || '';
    return '';
}

function extractImageUrls(html: string): string[] {
    const urls: string[] = [];
    const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        if (m[1] && !m[1].startsWith('data:')) urls.push(m[1]);
    }
    return [...new Set(urls)];
}

function generateSlug(str: string): string {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function htmlToText(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function parseWordPressXML(xmlText: string) {
    const cleanXml = xmlText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanXml, 'text/xml');

    const errors = doc.getElementsByTagName('parsererror');
    if (errors.length > 0) throw new Error('XML inválido. Verifique se o arquivo foi exportado corretamente do WordPress.');

    const channel = doc.getElementsByTagName('channel')[0];
    if (!channel) throw new Error('Formato XML inválido: elemento channel não encontrado');

    // Categories
    const categories: string[] = [];
    const wpCats = channel.getElementsByTagName('wp:category');
    for (let i = 0; i < wpCats.length; i++) {
        const name = getWpText(wpCats[i], 'wp:cat_name');
        if (name) categories.push(name);
    }

    // Authors
    const authors: { login: string; displayName: string; firstName: string; lastName: string }[] = [];
    const wpAuthors = channel.getElementsByTagName('wp:author');
    for (let i = 0; i < wpAuthors.length; i++) {
        const login = getWpText(wpAuthors[i], 'wp:author_login');
        const displayName = getWpText(wpAuthors[i], 'wp:author_display_name') || login;
        if (login) authors.push({ login, displayName, firstName: getWpText(wpAuthors[i], 'wp:author_first_name'), lastName: getWpText(wpAuthors[i], 'wp:author_last_name') });
    }

    // Posts
    const posts: ParsedPost[] = [];
    const items = channel.getElementsByTagName('item');
    const allItems = Array.from(items);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const postType = getWpText(item, 'wp:post_type');
        if (postType !== 'post') continue;
        const status = getWpText(item, 'wp:status');
        if (status !== 'publish' && status !== 'draft') continue;

        const title = getWpText(item, 'title') || 'Sem título';
        const slug = getWpText(item, 'wp:post_name') || generateSlug(title);
        const content = getWpText(item, 'content:encoded');
        const excerpt = getWpText(item, 'excerpt:encoded');
        const creator = getWpText(item, 'dc:creator');
        const postDate = getWpText(item, 'wp:post_date');

        let category = '';
        const catEls = item.getElementsByTagName('category');
        for (let c = 0; c < catEls.length; c++) {
            if (catEls[c].getAttribute('domain') === 'category') {
                category = catEls[c].textContent?.trim() || '';
                if (category) break;
            }
        }

        let thumbnailUrl = '';
        const postmetas = item.getElementsByTagName('wp:postmeta');
        for (let m = 0; m < postmetas.length; m++) {
            if (getWpText(postmetas[m], 'wp:meta_key') === '_thumbnail_id') {
                const thumbId = getWpText(postmetas[m], 'wp:meta_value');
                if (thumbId) {
                    for (const att of allItems) {
                        if (getWpText(att, 'wp:post_id') === thumbId && getWpText(att, 'wp:post_type') === 'attachment') {
                            thumbnailUrl = getWpText(att, 'wp:attachment_url') || att.getElementsByTagName('guid')[0]?.textContent?.trim() || '';
                            break;
                        }
                    }
                }
                break;
            }
        }

        const cleanContent = content.replace(/src=["']data:image\/[^"']+["']/gi, 'src=""');
        posts.push({ title, slug, content: cleanContent, excerpt, status, creator, postDate, category, thumbnailUrl, imageUrls: extractImageUrls(content) });
    }

    return { posts, authors, categories };
}

// ── GitHub API helpers (run in browser) ─────────────────────────────────────

async function ghFetch(url: string, token: string, options: RequestInit = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            ...((options.headers as Record<string, string>) || {}),
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.message || `GitHub API error ${res.status}`);
    }
    return res.json();
}

async function createBlob(api: string, token: string, content: string, encoding: 'utf-8' | 'base64' = 'utf-8'): Promise<string> {
    const data = await ghFetch(`${api}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({
            content: encoding === 'utf-8' ? btoa(unescape(encodeURIComponent(content))) : content,
            encoding: 'base64',
        }),
    });
    return data.sha;
}

/** Baixa imagem via proxy no servidor (evita CORS) */
async function downloadImageViaProxy(url: string): Promise<{ base64: string; ext: string } | null> {
    try {
        if (!url || url.startsWith('data:') || url.startsWith('/')) return null;
        const res = await fetch('/api/admin/plugins/import/wordpress', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'proxy-image', url }),
        });
        const data = await res.json();
        if (data.error || !data.base64) return null;
        return { base64: data.base64, ext: data.ext };
    } catch { return null; }
}

function serializePost(post: { title: string; slug: string; description: string; content: string; heroImage: string; category: string; author: string; pubDate: string; draft: boolean }): string {
    const t = post.title.replace(/"/g, '\\"');
    const d = post.description.replace(/"/g, '\\"');
    return `---\ntitle: "${t}"\ndescription: "${d}"\npubDate: "${post.pubDate}"\nheroImage: "${post.heroImage}"\ncategory: "${post.category}"\nauthor: "${post.author}"\ndraft: ${post.draft}\n---\n${post.content}`;
}

// ── Component ───────────────────────────────────────────────────────────────

interface LogEntry {
    time: string;
    type: 'info' | 'success' | 'skip' | 'error' | 'commit';
    message: string;
}

export default function ImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState('');
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState('');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logRef = useRef<HTMLDivElement>(null);

    const addLog = (type: LogEntry['type'], message: string) => {
        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [...prev, { time, type, message }]);
        setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.name.endsWith('.xml') && f.type !== 'text/xml' && f.type !== 'application/xml') {
            setError('Por favor, selecione um arquivo XML exportado do WordPress.');
            return;
        }
        setFile(f);
        setError('');
        setResult(null);
    };

    const handleImport = async () => {
        if (!file) { setError('Selecione um arquivo XML.'); return; }
        setImporting(true);
        setError('');
        setResult(null);
        setLogs([]);

        const stats = {
            postsImported: 0, postsSkipped: 0, postErrors: [] as string[], imagesImported: 0,
            authorsImported: 0, authorsSkipped: 0, categoriesImported: 0, categoriesSkipped: 0,
        };

        try {
            addLog('info', '🔌 Conectando ao servidor...');
            const configRes = await fetch('/api/admin/plugins/import/wordpress', {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get-config' }),
            });
            const config = await configRes.json();
            if (config.error) throw new Error(config.error);

            const { token, owner, repo } = config;
            const api = `https://api.github.com/repos/${owner}/${repo}`;
            addLog('success', `✓ Conectado ao repositório ${owner}/${repo}`);

            addLog('info', `📄 Lendo arquivo ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)...`);
            setProgress('Lendo arquivo XML...');
            const xmlText = await file.text();

            addLog('info', '⚙️ Processando XML...');
            setProgress('Processando XML...');
            const parsed = parseWordPressXML(xmlText);
            const totalPosts = parsed.posts.length;
            addLog('success', `✓ XML processado: ${totalPosts} posts, ${parsed.categories.length} categorias, ${parsed.authors.length} autores`);

            // Categories & authors
            let currentCategories: string[] = config.categories || [];
            let currentAuthors: any[] = config.authors || [];
            const authorLoginToId = new Map<string, string>();
            const existingSlugs = new Set<string>(config.existingSlugs || []);

            for (const name of parsed.categories) {
                if (!name || currentCategories.includes(name)) { stats.categoriesSkipped++; continue; }
                currentCategories.push(name);
                stats.categoriesImported++;
            }
            for (const a of parsed.authors) {
                if (!a.login) continue;
                const id = generateSlug(a.login);
                authorLoginToId.set(a.login, id);
                if (currentAuthors.some((x: any) => x.id === id)) { stats.authorsSkipped++; continue; }
                currentAuthors.push({ id, name: a.displayName, role: 'Autor', avatar: '', bio: `${a.firstName} ${a.lastName}`.trim() || a.displayName });
                stats.authorsImported++;
            }

            if (stats.categoriesImported > 0) addLog('success', `✓ ${stats.categoriesImported} nova(s) categoria(s): ${currentCategories.slice(-stats.categoriesImported).join(', ')}`);
            if (stats.authorsImported > 0) addLog('success', `✓ ${stats.authorsImported} novo(s) autor(es) importado(s)`);

            const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];

            if (stats.categoriesImported > 0) {
                const sha = await createBlob(api, token, JSON.stringify(currentCategories, null, 2));
                treeItems.push({ path: 'src/data/categories.json', mode: '100644', type: 'blob', sha });
            }
            if (stats.authorsImported > 0) {
                const sha = await createBlob(api, token, JSON.stringify(currentAuthors, null, 2));
                treeItems.push({ path: 'src/data/authors.json', mode: '100644', type: 'blob', sha });
            }

            const COMMIT_EVERY = 20;
            let commitCount = 0;

            async function commitTreeItems(items: typeof treeItems, message: string) {
                if (items.length === 0) return;
                const refData = await ghFetch(`${api}/git/ref/heads/main`, token);
                const baseCommitSha = refData.object.sha;
                const commitData = await ghFetch(`${api}/git/commits/${baseCommitSha}`, token);
                const newTree = await ghFetch(`${api}/git/trees`, token, {
                    method: 'POST',
                    body: JSON.stringify({ base_tree: commitData.tree.sha, tree: items }),
                });
                const newCommit = await ghFetch(`${api}/git/commits`, token, {
                    method: 'POST',
                    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] }),
                });
                await ghFetch(`${api}/git/refs/heads/main`, token, {
                    method: 'PATCH',
                    body: JSON.stringify({ sha: newCommit.sha }),
                });
                commitCount++;
            }

            // Check existing posts
            addLog('info', '🔍 Verificando posts já existentes no repositório...');
            setProgress('Verificando duplicatas...');
            const existingFiles = new Set<string>();
            try {
                const tree = await ghFetch(`${api}/git/trees/main?recursive=1`, token);
                for (const item of (tree.tree || [])) {
                    if (item.path?.startsWith('src/content/blog/') && item.path.endsWith('.md')) {
                        existingFiles.add(item.path);
                    }
                }
            } catch {}
            addLog('info', `📂 ${existingFiles.size} post(s) já existem no repositório`);

            let postsInBatch = 0;

            for (let i = 0; i < totalPosts; i++) {
                const post = parsed.posts[i];
                const pct = Math.round(25 + (i / totalPosts) * 65);
                setProgress(`Post ${i + 1}/${totalPosts}: "${post.title.substring(0, 45)}..."`);
                if (i % 5 === 0) triggerToast(`Post ${i + 1}/${totalPosts}`, 'progress', pct);

                try {
                    let slug = post.slug || generateSlug(post.title);
                    if (!slug) { stats.postsSkipped++; continue; }

                    const filePath = `src/content/blog/${slug}.md`;
                    if (existingFiles.has(filePath)) {
                        addLog('skip', `⏭️ "${post.title}" — já existe (/blog/${slug})`);
                        stats.postsSkipped++;
                        continue;
                    }

                    let base = slug, counter = 1;
                    while (existingSlugs.has(slug)) slug = `${base}-${counter++}`;
                    existingSlugs.add(slug);

                    const authorId = post.creator ? (authorLoginToId.get(post.creator) || generateSlug(post.creator)) : '';

                    let pubDate = '';
                    if (post.postDate && post.status === 'publish') {
                        try { const d = new Date(post.postDate.replace(' ', 'T')); if (!isNaN(d.getTime())) pubDate = d.toISOString().split('T')[0]; } catch {}
                    }
                    if (!pubDate) pubDate = new Date().toISOString().split('T')[0];

                    // Thumbnail
                    let heroImage = '';
                    let imgCount = 0;
                    if (post.thumbnailUrl) {
                        try {
                            const dl = await downloadImageViaProxy(post.thumbnailUrl);
                            if (dl) {
                                const fn = `${Date.now()}-${slug}-thumb.${dl.ext}`;
                                const sha = await createBlob(api, token, dl.base64, 'base64');
                                treeItems.push({ path: `public/uploads/${fn}`, mode: '100644', type: 'blob', sha });
                                heroImage = `/uploads/${fn}`;
                                stats.imagesImported++;
                                imgCount++;
                            }
                        } catch {}
                    }

                    // Content images (limit to first 5)
                    let content = post.content;
                    const imgUrls = post.imageUrls.slice(0, 5);
                    for (const imgUrl of imgUrls) {
                        try {
                            const dl = await downloadImageViaProxy(imgUrl);
                            if (dl) {
                                const fn = `${Date.now()}-${slug}-${Math.random().toString(36).slice(2, 5)}.${dl.ext}`;
                                const sha = await createBlob(api, token, dl.base64, 'base64');
                                treeItems.push({ path: `public/uploads/${fn}`, mode: '100644', type: 'blob', sha });
                                content = content.split(imgUrl).join(`/uploads/${fn}`);
                                stats.imagesImported++;
                                imgCount++;
                            }
                        } catch {}
                    }

                    let description = '';
                    if (post.excerpt) description = htmlToText(post.excerpt).substring(0, 160);
                    if (!description && content) description = htmlToText(content).substring(0, 160);

                    const md = serializePost({
                        title: post.title, slug, description, content, heroImage,
                        category: post.category || '', author: authorId,
                        pubDate, draft: post.status === 'draft',
                    });

                    const sha = await createBlob(api, token, md);
                    treeItems.push({ path: `src/content/blog/${slug}.md`, mode: '100644', type: 'blob', sha });
                    stats.postsImported++;
                    postsInBatch++;

                    const imgInfo = imgCount > 0 ? ` + ${imgCount} img` : '';
                    addLog('success', `✓ ${i + 1}/${totalPosts} — "${post.title}" → /blog/${slug}${imgInfo}`);
                } catch (err: any) {
                    addLog('error', `✗ "${post.title}": ${err.message}`);
                    stats.postErrors.push(`"${post.title}": ${err.message}`);
                    stats.postsSkipped++;
                }

                // Commit a cada 20 posts
                if (postsInBatch >= COMMIT_EVERY) {
                    addLog('commit', `💾 Salvando lote ${commitCount + 1} (${postsInBatch} posts)...`);
                    setProgress(`Salvando lote ${commitCount + 1}...`);
                    await commitTreeItems(treeItems, `CMS: Import WP — lote ${commitCount + 1} (${postsInBatch} posts)`);
                    addLog('commit', `✓ Lote ${commitCount} salvo no repositório!`);
                    treeItems.length = 0;
                    postsInBatch = 0;
                }
            }

            // Commit final
            if (treeItems.length > 0) {
                addLog('commit', `💾 Salvando lote final (${postsInBatch} posts)...`);
                setProgress('Salvando lote final...');

                const refData = await ghFetch(`${api}/git/ref/heads/main`, token);
                const baseCommitSha = refData.object.sha;
                const commitData = await ghFetch(`${api}/git/commits/${baseCommitSha}`, token);

                const newTree = await ghFetch(`${api}/git/trees`, token, {
                    method: 'POST',
                    body: JSON.stringify({ base_tree: commitData.tree.sha, tree: treeItems }),
                });
                const newCommit = await ghFetch(`${api}/git/commits`, token, {
                    method: 'POST',
                    body: JSON.stringify({
                        message: `CMS: Import WordPress — ${stats.postsImported} posts, ${stats.categoriesImported} cat, ${stats.authorsImported} autores`,
                        tree: newTree.sha,
                        parents: [baseCommitSha],
                    }),
                });
                await ghFetch(`${api}/git/refs/heads/main`, token, {
                    method: 'PATCH',
                    body: JSON.stringify({ sha: newCommit.sha }),
                });
                addLog('commit', `✓ Lote final salvo!`);
            }

            // Save categories/authors
            if (stats.categoriesImported > 0 || stats.authorsImported > 0) {
                await fetch('/api/admin/plugins/import/wordpress', {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'save-meta',
                        categories: stats.categoriesImported > 0 ? currentCategories : null,
                        authors: stats.authorsImported > 0 ? currentAuthors : null,
                    }),
                });
            }

            addLog('success', `🎉 Importação concluída! ${stats.postsImported} posts importados, ${stats.imagesImported} imagens, ${commitCount + (treeItems.length > 0 ? 1 : 0)} commit(s)`);

            const finalResult: ImportResult = {
                success: true,
                posts: { imported: stats.postsImported, skipped: stats.postsSkipped, errors: stats.postErrors, imagesImported: stats.imagesImported },
                authors: { imported: stats.authorsImported, skipped: stats.authorsSkipped },
                categories: { imported: stats.categoriesImported, skipped: stats.categoriesSkipped },
                errors: [],
            };

            setResult(finalResult);
            triggerToast(`Concluído! ${stats.postsImported} posts importados.`, 'success');

        } catch (err: any) {
            addLog('error', `❌ Erro fatal: ${err.message}`);
            setError(err.message || 'Erro ao importar');
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setImporting(false);
            setProgress('');
        }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3">Como exportar do WordPress</p>
                <ol className="space-y-1.5">
                    {['No painel WordPress, vá em Ferramentas → Exportar', 'Selecione "Todos os posts" ou "Todo o conteúdo"', 'Clique em "Baixar arquivo de exportação"', 'Faça upload do arquivo .xml aqui'].map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-blue-800">
                            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">O que será importado</p>
                <div className="grid grid-cols-2 gap-3">
                    {[{ icon: '📝', label: 'Posts publicados e rascunhos' }, { icon: '👥', label: 'Autores' }, { icon: '🏷️', label: 'Categorias' }, { icon: '🖼️', label: 'Imagens (quando disponíveis)' }].map(item => (
                        <div key={item.label} className="flex items-center gap-2 text-sm text-slate-600"><span>{item.icon}</span>{item.label}</div>
                    ))}
                </div>
                <p className="text-xs text-slate-400 mt-3">Posts com o mesmo slug já existentes serão ignorados. Autores e categorias duplicados também.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Arquivo de Exportação (.xml)</p>
                <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${file ? 'border-violet-300 bg-violet-50' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/50'}`} onClick={() => fileInputRef.current?.click()}>
                    {file ? (
                        <><FileText className="w-8 h-8 text-violet-500 mx-auto mb-2" /><p className="font-medium text-slate-800 text-sm">{file.name}</p><p className="text-xs text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · Clique para trocar</p></>
                    ) : (
                        <><Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="font-medium text-slate-500 text-sm">Clique para selecionar o arquivo XML</p><p className="text-xs text-slate-400 mt-1">Sem limite de tamanho</p></>
                    )}
                </div>
                <input ref={fileInputRef} type="file" accept=".xml,text/xml,application/xml" onChange={handleFileChange} className="hidden" />
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}

            {result && (
                <div className={`bg-white rounded-2xl border shadow-sm p-6 ${result.success ? 'border-green-200' : 'border-amber-200'}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className={`w-5 h-5 ${result.success ? 'text-green-500' : 'text-amber-500'}`} />
                        <p className="font-bold text-slate-800">{result.success ? 'Importação concluída!' : 'Importação concluída com erros'}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {[{ label: 'Posts', imported: result.posts.imported, skipped: result.posts.skipped }, { label: 'Autores', imported: result.authors.imported, skipped: result.authors.skipped }, { label: 'Categorias', imported: result.categories.imported, skipped: result.categories.skipped }].map(s => (
                            <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-2xl font-bold text-violet-600">{s.imported}</p>
                                <p className="text-xs text-slate-500">{s.label} importados</p>
                                {s.skipped > 0 && <p className="text-xs text-slate-400">{s.skipped} ignorados</p>}
                            </div>
                        ))}
                    </div>
                    {result.posts.imagesImported > 0 && <p className="text-sm text-slate-600 mb-3">🖼️ {result.posts.imagesImported} imagem(ns) importada(s)</p>}
                    {result.posts.errors.length > 0 && (
                        <div><p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Erros</p><div className="max-h-32 overflow-y-auto space-y-1">{result.posts.errors.map((e, i) => <p key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{e}</p>)}</div></div>
                    )}
                    <a href="/admin/posts" className="mt-4 inline-block text-sm text-violet-600 hover:underline font-medium">→ Ver posts importados</a>
                </div>
            )}

            <button type="button" onClick={handleImport} disabled={importing || !file} className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-violet-600/20">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</> : <><Upload className="w-4 h-4" /> Importar do WordPress</>}
            </button>

            {/* Log em tempo real */}
            {(importing || logs.length > 0) && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Log de Importação</p>
                        {importing && <span className="text-xs text-violet-600 font-medium animate-pulse">{progress}</span>}
                    </div>
                    <div ref={logRef} className="max-h-72 overflow-y-auto p-3 space-y-1 font-mono text-xs">
                        {logs.map((log, i) => (
                            <div key={i} className={`flex gap-2 px-2 py-1 rounded ${
                                log.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
                                log.type === 'skip' ? 'bg-slate-50 text-slate-400' :
                                log.type === 'error' ? 'bg-red-50 text-red-600' :
                                log.type === 'commit' ? 'bg-violet-50 text-violet-700 font-semibold' :
                                'text-slate-600'
                            }`}>
                                <span className="text-slate-300 shrink-0">{log.time}</span>
                                <span>{log.message}</span>
                            </div>
                        ))}
                        {importing && (
                            <div className="flex gap-2 px-2 py-1 text-violet-500 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin mt-0.5" />
                                <span>Processando...</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
