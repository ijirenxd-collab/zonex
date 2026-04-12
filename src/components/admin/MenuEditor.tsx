import React, { useState, useEffect } from 'react';
import { Navigation, Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, AlertCircle, LayoutList, ExternalLink, ChevronRight, Layers } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

type SubMenuItem = {
    label: string;
    href: string;
};

type MenuItem = {
    label: string;
    href: string;
    categories?: SubMenuItem[];
};

export default function MenuEditor() {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        githubApi('read', 'src/data/menu.json')
            .then(data => {
                const parsed = JSON.parse(data.content);
                setItems(Array.isArray(parsed.items) ? parsed.items : []);
                setFileSha(data.sha);
            })
            .catch(err => {
                if (err.message.includes('404')) setItems([]);
                else setError(err.message);
            })
            .finally(() => setLoading(false));
    }, []);

    async function save() {
        setSaving(true);
        triggerToast('Sincronizando menu...', 'progress');
        try {
            const res = await githubApi('write', 'src/data/menu.json', {
                content: JSON.stringify({ items }, null, 4),
                sha: fileSha,
            });
            setFileSha(res.sha);
            triggerToast('Menu global atualizado!', 'success');
        } catch (err: any) {
            triggerToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    }

    const addItem = () => setItems(prev => [...prev, { label: 'Novo Link', href: '/', categories: [] }]);
    const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

    const moveItem = (i: number, dir: number) => {
        setItems(prev => {
            const next = [...prev];
            const j = i + dir;
            if (j < 0 || j >= next.length) return prev;
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });
    };

    const updateItem = (i: number, field: keyof MenuItem, value: any) => {
        setItems(prev => {
            const next = [...prev];
            next[i] = { ...next[i], [field]: value };
            return next;
        });
    };

    const addSubItem = (i: number) => {
        setItems(prev => {
            const next = [...prev];
            const cats = Array.isArray(next[i].categories) ? next[i].categories : [];
            next[i] = { ...next[i], categories: [...(cats as any), { label: 'Sublink', href: '/' }] };
            return next;
        });
    };

    const updateSubItem = (i: number, subIdx: number, field: keyof SubMenuItem, value: string) => {
        setItems(prev => {
            const next = [...prev];
            const cats = [...(next[i].categories || [])];
            cats[subIdx] = { ...cats[subIdx], [field]: value };
            next[i] = { ...next[i], categories: cats };
            return next;
        });
    };

    const removeSubItem = (i: number, subIdx: number) => {
        setItems(prev => {
            const next = [...prev];
            next[i] = { ...next[i], categories: next[i].categories?.filter((_, idx) => idx !== subIdx) };
            return next;
        });
    };

    if (loading) return <div className="p-20 text-center text-slate-400"><Loader2 className="animate-spin mx-auto w-10 h-10 text-violet-500 mb-4" /> Carregando Navegação...</div>;

    const inputClass = "w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-xs transition-all";
    const labelClass = "block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-wider";

    return (
        <div className="max-w-3xl space-y-6 pb-20">
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-100 sticky top-4 z-40">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-200">
                        <Navigation className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Menu Principal</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Navegação Global</p>
                    </div>
                </div>
                <button onClick={save} disabled={saving} className="bg-violet-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-50 shadow-sm">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Publicando...' : 'Publicar'}
                </button>
            </div>

            <div className="space-y-4">
                {items.map((item, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden group">
                        <div className="flex items-center gap-3 p-4 bg-slate-50/50 border-b border-slate-100">
                            <div className="flex flex-col gap-1 items-center justify-center">
                                <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="text-slate-300 hover:text-violet-500 disabled:opacity-0 transition-colors"><ChevronUp className="w-4 h-4" /></button>
                                <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="text-slate-300 hover:text-violet-500 disabled:opacity-0 transition-colors"><ChevronDown className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-4 flex-1">
                                <div>
                                    <label className={labelClass}>Nome</label>
                                    <input type="text" value={item.label} onChange={e => updateItem(i, 'label', e.target.value)} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>URL</label>
                                    <input type="text" value={item.href} onChange={e => updateItem(i, 'href', e.target.value)} className={inputClass} />
                                </div>
                            </div>
                            <button onClick={() => removeItem(i)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                        </div>

                        {/* Submenus */}
                        <div className="p-4 space-y-3 pl-12 relative">
                            <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-100"></div>
                            {item.categories?.map((sub, sIdx) => (
                                <div key={sIdx} className="flex items-center gap-2 relative">
                                    <div className="absolute -left-6 top-1/2 w-4 h-px bg-slate-100"></div>
                                    <ChevronRight className="w-3 h-3 text-slate-300" />
                                    <input type="text" value={sub.label} onChange={e => updateSubItem(i, sIdx, 'label', e.target.value)} className={`${inputClass} !bg-white`} placeholder="Sublink" />
                                    <input type="text" value={sub.href} onChange={e => updateSubItem(i, sIdx, 'href', e.target.value)} className={`${inputClass} !bg-white`} placeholder="/url-sub" />
                                    <button onClick={() => removeSubItem(i, sIdx)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><Plus className="w-3 h-3 rotate-45" /></button>
                                </div>
                            ))}
                            <button onClick={() => addSubItem(i)} className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 hover:text-violet-500 uppercase tracking-tighter pl-5 mt-2">
                                <Layers className="w-3 h-3" /> Adicionar Submenu
                            </button>
                        </div>
                    </div>
                ))}

                <button onClick={addItem} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-slate-400 font-bold hover:border-violet-300 hover:text-violet-500 transition-all active:scale-[0.99]">
                    <Plus className="w-5 h-5" /> Adicionar Link Principal
                </button>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="text-xs text-amber-700 leading-relaxed">
                    <p className="font-bold mb-1">Nota importante:</p>
                    Links com submenus aparecerão com uma seta no topo do site. Certifique-se de usar URLs válidas como <code className="bg-amber-100 px-1 rounded">/sobre</code> ou <code className="bg-amber-100 px-1 rounded">https://google.com</code>.
                </div>
            </div>
        </div>
    );
}
