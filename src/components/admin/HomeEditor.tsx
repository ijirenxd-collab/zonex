import React, { useState, useEffect } from 'react';
import { Home, TrendingUp, Mail, Users, Save, Loader2, Plus, Trash2, Upload, FileImage, Eye, EyeOff } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

type PostMeta = { slug: string; title: string };

type HomeConfig = {
    showPartners?: boolean;
    hero: {
        title: string;
        description: string;
        image: string;
        slugs: string[];
        postLimit: number;
    };
    trending: {
        title: string;
        slugs: string[];
        postLimit: number;
    };
    newsletter: {
        title: string;
        description: string;
        buttonText: string;
        bgImage: string;
    };
    recentPosts: {
        title: string;
        searchPlaceholder: string;
        postLimit: number;
    };
    partners: string[];
};

const DEFAULT_CONFIG: HomeConfig = {
    showPartners: true,
    hero: { title: '', description: '', image: '', slugs: [], postLimit: 4 },
    trending: { title: 'Tendências', slugs: [], postLimit: 6 },
    newsletter: { title: '', description: '', buttonText: 'Inscrever-se', bgImage: '' },
    recentPosts: { title: 'Artigos Recentes', searchPlaceholder: 'Buscar..', postLimit: 9 },
    partners: []
};

function PostPicker({ value, posts, onChange, placeholder }: {
    value: string; posts: PostMeta[]; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all"
        >
            <option value="">{placeholder || '— Automático (mais recente) —'}</option>
            {posts.map(p => (
                <option key={p.slug} value={p.slug}>{p.title}</option>
            ))}
        </select>
    );
}

export default function HomeEditor() {
    const [config, setConfig] = useState<HomeConfig>(DEFAULT_CONFIG);
    const [posts, setPosts] = useState<PostMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fileSha, setFileSha] = useState('');
    const [pendingUploads, setPendingUploads] = useState<Record<string, File>>({});

    useEffect(() => {
        async function load() {
            try {
                const data = await githubApi('read', 'src/data/home.json');
                setConfig(JSON.parse(data.content));
                setFileSha(data.sha);

                const fileList = await githubApi('list', 'src/content/blog');
                const mdFiles = (fileList.data || []).filter((f: any) => f.name.endsWith('.md'));
                setPosts(mdFiles.map((f: any) => ({
                    slug: f.name.replace('.md', ''),
                    title: f.name.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                })));
            } catch (err) {
                console.error('Erro ao carregar dados', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, uiKey: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingUploads(prev => ({ ...prev, [uiKey]: file }));
        const previewUrl = URL.createObjectURL(file);

        if (uiKey === 'heroImg') setConfig(prev => ({ ...prev, hero: { ...prev.hero, image: previewUrl } }));
        if (uiKey === 'newsletterImg') setConfig(prev => ({ ...prev, newsletter: { ...prev.newsletter, bgImage: previewUrl } }));
        if (uiKey.startsWith('partnerImg-')) {
            const idx = parseInt(uiKey.split('-')[1]);
            const next = [...config.partners];
            next[idx] = previewUrl;
            setConfig(prev => ({ ...prev, partners: next }));
        }
        e.target.value = '';
    };

    const save = async () => {
        setSaving(true);
        triggerToast('Sincronizando com git...', 'progress');
        try {
            let finalConfig = { ...config };

            for (const [key, file] of Object.entries(pendingUploads)) {
                const base64 = await fileToBase64(file);
                const ext = file.name.split('.').pop() || 'png';
                const filename = `${Date.now()}-${key}.${ext}`;
                const path = `public/uploads/${filename}`;
                await githubApi('write', path, { content: base64, isBase64: true });

                const url = `/uploads/${filename}`;
                if (key === 'heroImg') finalConfig.hero.image = url;
                if (key === 'newsletterImg') finalConfig.newsletter.bgImage = url;
                if (key.startsWith('partnerImg-')) {
                    const idx = parseInt(key.split('-')[1]);
                    finalConfig.partners[idx] = url;
                }
            }

            const res = await githubApi('write', 'src/data/home.json', {
                content: JSON.stringify(finalConfig, null, 4),
                sha: fileSha
            });

            setFileSha(res.sha);
            setConfig(finalConfig);
            setPendingUploads({});
            triggerToast('Homepage salva!', 'success');
        } catch (err: any) {
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const updateField = (path: string, value: any) => {
        setConfig(prev => {
            const next = { ...prev };
            const parts = path.split('.');
            let current: any = next;
            for (let i = 0; i < parts.length - 1; i++) {
                current[parts[i]] = { ...current[parts[i]] };
                current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = value;
            return next;
        });
    };

    if (loading) return <div className="p-20 text-center text-slate-400"><Loader2 className="animate-spin mx-auto w-10 h-10 text-violet-500 mb-4" /> Atualizando Editor...</div>;

    const labelClass = "block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest";
    const inputClass = "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-sm transition-all";

    return (
        <div className="max-w-4xl space-y-8 pb-32">
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-4 z-40">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Capa & Seções</h2>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Home 3 Premium</p>
                </div>
                <button onClick={save} disabled={saving} className="bg-violet-600 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-violet-700 shadow-xl shadow-violet-600/20 active:scale-95 transition-all disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Publicando...' : 'Publicar'}
                </button>
            </div>

            {/* HERO */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-violet-600"></div>
                <h3 className="text-lg font-bold mb-8 flex items-center gap-2 text-slate-800"><Home className="w-5 h-5 text-violet-600" /> Banner Hero</h3>
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            <label className={labelClass}>Título SEO</label>
                            <input type="text" value={config.hero.title} onChange={e => updateField('hero.title', e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Descrição Oculta</label>
                            <textarea rows={3} value={config.hero.description} onChange={e => updateField('hero.description', e.target.value)} className={inputClass} />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className={labelClass}>Fundo do Hero</label>
                        <div className="relative aspect-video rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 group">
                            <img src={config.hero.image} className="w-full h-full object-cover" />
                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <Upload className="text-white w-8 h-8" />
                                <input type="file" className="hidden" onChange={e => handleFileSelect(e, 'heroImg')} />
                            </label>
                        </div>
                    </div>
                    {/* Hero Slugs */}
                    <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-50">
                        <label className={labelClass}>Curadoria: Escolher Posts Manuais (Hero)</label>
                        <div className="space-y-2">
                            {config.hero.slugs.map((slug, i) => (
                                <div key={i} className="flex gap-2">
                                    <PostPicker value={slug} posts={posts} onChange={v => {
                                        const next = [...config.hero.slugs]; next[i] = v; updateField('hero.slugs', next);
                                    }} />
                                    <button onClick={() => updateField('hero.slugs', config.hero.slugs.filter((_, idx) => idx !== i))} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                                </div>
                            ))}
                            <button onClick={() => updateField('hero.slugs', [...config.hero.slugs, ''])} className="text-violet-600 text-[10px] font-black uppercase flex items-center gap-1 hover:underline mt-2 tracking-tighter">+ Adicionar Post ao Slide</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* TRENDING */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
                <h3 className="text-lg font-bold mb-8 flex items-center gap-2 text-slate-800"><TrendingUp className="w-5 h-5 text-amber-500" /> Seção de Tendências</h3>
                <div className="space-y-6">
                    <div>
                        <label className={labelClass}>Título da Seção</label>
                        <input type="text" value={config.trending.title} onChange={e => updateField('trending.title', e.target.value)} className={inputClass} />
                    </div>
                    <div className="space-y-4">
                        <label className={labelClass}>Curadoria: Posts em Tendência</label>
                        <div className="space-y-2">
                            {config.trending.slugs.map((slug, i) => (
                                <div key={i} className="flex gap-2">
                                    <PostPicker value={slug} posts={posts} onChange={v => {
                                        const next = [...config.trending.slugs]; next[i] = v; updateField('trending.slugs', next);
                                    }} />
                                    <button onClick={() => updateField('trending.slugs', config.trending.slugs.filter((_, idx) => idx !== i))} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                                </div>
                            ))}
                            <button onClick={() => updateField('trending.slugs', [...config.trending.slugs, ''])} className="text-amber-600 text-[10px] font-black uppercase flex items-center gap-1 hover:underline mt-2 tracking-tighter">+ Fixar Post em Tendência</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* NEWSLETTER */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                <h3 className="text-lg font-bold mb-8 flex items-center gap-2 text-slate-800"><Mail className="w-5 h-5 text-emerald-500" /> Newsletter</h3>
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            <label className={labelClass}>Título</label>
                            <input type="text" value={config.newsletter.title} onChange={e => updateField('newsletter.title', e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Descrição</label>
                            <textarea rows={2} value={config.newsletter.description} onChange={e => updateField('newsletter.description', e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Texto Botão</label>
                            <input type="text" value={config.newsletter.buttonText} onChange={e => updateField('newsletter.buttonText', e.target.value)} className={inputClass} />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className={labelClass}>Fundo Newsletter</label>
                        <div className="relative aspect-[4/3] rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 group">
                            <img src={config.newsletter.bgImage} className="w-full h-full object-cover" />
                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <Upload className="text-white w-8 h-8" />
                                <input type="file" className="hidden" onChange={e => handleFileSelect(e, 'newsletterImg')} />
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* PARCEIROS */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Users className="w-5 h-5 text-blue-500" /> Parceiros</h3>
                    <button
                        onClick={() => setConfig(prev => ({ ...prev, showPartners: !prev.showPartners }))}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${config.showPartners !== false ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}
                    >
                        {config.showPartners !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        {config.showPartners !== false ? 'SEÇÃO ATIVA' : 'SEÇÃO OCULTA'}
                    </button>
                </div>

                {config.showPartners !== false && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-300">
                        {config.partners.map((p, i) => (
                            <div key={i} className="group relative aspect-square bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center p-4 hover:border-blue-400 transition-all">
                                {p ? <img src={p} className="max-w-full max-h-full object-contain mix-blend-multiply" /> : <div className="text-slate-300"><FileImage /></div>}
                                <div className="absolute inset-x-2 bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <label className="flex-1 bg-white border border-slate-200 p-2 rounded-xl flex items-center justify-center cursor-pointer hover:bg-blue-50 shadow-sm">
                                        <Upload className="w-3 h-3 text-blue-600" />
                                        <input type="file" className="hidden" onChange={e => handleFileSelect(e, `partnerImg-${i}`)} />
                                    </label>
                                    <button onClick={() => setConfig(prev => ({ ...prev, partners: prev.partners.filter((_, idx) => idx !== i) }))} className="bg-white border border-slate-200 p-2 rounded-xl text-rose-500 hover:bg-rose-50 shadow-sm">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setConfig(prev => ({ ...prev, partners: [...prev.partners, ''] }))} className="aspect-square border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-300 hover:border-blue-500 hover:text-blue-500 transition-all active:scale-95 group">
                            <Plus className="w-6 h-6 mb-2 group-hover:scale-125 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Adicionar</span>
                        </button>
                    </div>
                )}
                {config.showPartners === false && (
                    <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 text-sm italic font-medium">
                        A seção de parceiros não será exibida na Home.
                    </div>
                )}
            </div>
        </div>
    );
}
