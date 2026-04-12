import React, { useState, useEffect } from 'react';
import { Save, Loader2, Info, Target, Eye, Plus, Trash2, Upload } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

type AboutConfig = {
    title: string;
    intro: {
        title: string;
        description: string;
        image: string;
        features: string[];
    };
    mission: { title: string; description: string };
    vision: { title: string; description: string };
};

const DEFAULT_CONFIG: AboutConfig = {
    title: 'Sobre Nós',
    intro: { title: '', description: '', image: '', features: [] },
    mission: { title: 'Missão', description: '' },
    vision: { title: 'Visão', description: '' }
};

export default function SobreEditor() {
    const [config, setConfig] = useState<AboutConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fileSha, setFileSha] = useState('');
    const [pendingUploads, setPendingUploads] = useState<Record<string, File>>({});

    useEffect(() => {
        async function load() {
            try {
                const data = await githubApi('read', 'src/data/about.json');
                setConfig(JSON.parse(data.content));
                setFileSha(data.sha);
            } catch (err) {
                console.error('Erro ao carregar about.json', err);
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
        if (uiKey === 'aboutImg') setConfig(prev => ({ ...prev, intro: { ...prev.intro, image: previewUrl } }));
        e.target.value = '';
    };

    const save = async () => {
        setSaving(true);
        try {
            let finalConfig = { ...config };

            for (const [key, file] of Object.entries(pendingUploads)) {
                const base64 = await fileToBase64(file);
                const ext = file.name.split('.').pop() || 'jpg';
                const filename = `${Date.now()}-${key}.${ext}`;
                const path = `public/uploads/${filename}`;

                await githubApi('write', path, {
                    content: base64,
                    isBase64: true,
                    message: `Upload image: ${filename}`
                });

                if (key === 'aboutImg') finalConfig.intro.image = `/uploads/${filename}`;
            }

            const res = await githubApi('write', 'src/data/about.json', {
                content: JSON.stringify(finalConfig, null, 4),
                sha: fileSha
            });

            setFileSha(res.sha);
            setConfig(finalConfig);
            setPendingUploads({});
            triggerToast('Página Sobre atualizada!', 'success');
        } catch (err: any) {
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const updateNested = (section: string, field: string, value: any) => {
        if (section === 'root') {
            setConfig(prev => ({ ...prev, [field]: value }));
        } else {
            setConfig(prev => ({
                ...prev,
                [section]: {
                    ...(prev[section] as any),
                    [field]: value
                }
            }));
        }
    };

    const addFeature = () => {
        setConfig(prev => ({ ...prev, intro: { ...prev.intro, features: [...prev.intro.features, ''] } }));
    };

    const updateFeature = (index: number, value: string) => {
        const f = [...config.intro.features];
        f[index] = value;
        setConfig(prev => ({ ...prev, intro: { ...prev.intro, features: f } }));
    };

    const removeFeature = (index: number) => {
        setConfig(prev => ({ ...prev, intro: { ...prev.intro, features: prev.intro.features.filter((_, i) => i !== index) } }));
    };

    if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto w-10 h-10 text-violet-500" /></div>;

    const inputClass = "w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm";
    const labelClass = "block text-xs font-bold text-slate-500 uppercase mb-2";

    return (
        <div className="max-w-4xl space-y-8 pb-32">
            <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-4 z-20">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Página Sobre</h2>
                    <p className="text-sm text-slate-500">Mapeamento dinâmico Bunzo</p>
                </div>
                <button onClick={save} disabled={saving} className="bg-violet-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-violet-700 transition-all shadow-md">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Salvando...' : 'Salvar Página'}
                </button>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6 text-blue-500 border-b pb-4">
                    <Info className="w-6 h-6" />
                    <h3 className="text-lg font-bold text-slate-800">1. Introdução da Empresa</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            <label className={labelClass}>Título Principal (H2)</label>
                            <input type="text" value={config.intro.title} onChange={e => updateNested('intro', 'title', e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Texto da História</label>
                            <textarea rows={4} value={config.intro.description} onChange={e => updateNested('intro', 'description', e.target.value)} className={inputClass} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Imagem Lateral</label>
                        <div className="flex flex-col gap-4">
                            {config.intro.image && <img src={config.intro.image} className="aspect-square w-full object-cover rounded-xl border border-slate-200" />}
                            <label className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-all text-sm font-bold justify-center">
                                <Upload className="w-4 h-4" /> Upload de Imagem
                                <input type="file" accept="image/*" className="hidden" onChange={e => handleFileSelect(e, 'aboutImg')} />
                            </label>
                            {pendingUploads['aboutImg'] && <p className="text-[10px] text-violet-600 font-bold uppercase mt-1">● Upload Pendente</p>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-6 text-amber-500 border-b pb-4">
                    <Target className="w-6 h-6" />
                    <h3 className="text-lg font-bold text-slate-800">2. Diferenciais e Destaques</h3>
                </div>
                <div className="space-y-3">
                    {config.intro.features.map((f, i) => (
                        <div key={i} className="flex gap-2">
                            <input type="text" value={f} onChange={e => updateFeature(i, e.target.value)} className={inputClass} placeholder="Ex: Atendimento especializado" />
                            <button onClick={() => removeFeature(i)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="w-5 h-5" /></button>
                        </div>
                    ))}
                    <button onClick={addFeature} className="flex items-center gap-2 text-violet-600 font-bold text-sm bg-violet-50 px-4 py-2 rounded-lg hover:bg-violet-100 mt-2">
                        <Plus className="w-4 h-4" /> Novo Item
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-emerald-600"><Target className="w-5 h-5" /> Nossa Missão</h3>
                    <div className="space-y-4">
                        <input type="text" value={config.mission.title} onChange={e => updateNested('mission', 'title', e.target.value)} className={inputClass} placeholder="Título" />
                        <textarea rows={4} value={config.mission.description} onChange={e => updateNested('mission', 'description', e.target.value)} className={inputClass} placeholder="Descrição detalhada..." />
                    </div>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-rose-600"><Eye className="w-5 h-5" /> Nossa Visão</h3>
                    <div className="space-y-4">
                        <input type="text" value={config.vision.title} onChange={e => updateNested('vision', 'title', e.target.value)} className={inputClass} placeholder="Título" />
                        <textarea rows={4} value={config.vision.description} onChange={e => updateNested('vision', 'description', e.target.value)} className={inputClass} placeholder="Descrição detalhada..." />
                    </div>
                </div>
            </div>
        </div>
    );
}
