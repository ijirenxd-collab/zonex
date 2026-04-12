import React, { useState, useEffect } from 'react';
import { Save, Loader2, MapPin, Phone, Mail, Map, AlertCircle, Info } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

type ContactConfig = {
    title: string;
    address: string;
    phone: string;
    email: string;
    googleMapsUrl: string;
    formTitle: string;
};

export default function ContatoEditor() {
    const [config, setConfig] = useState<ContactConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fileSha, setFileSha] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const data = await githubApi('read', 'src/data/contact.json');
                setConfig(JSON.parse(data.content));
                setFileSha(data.sha);
            } catch (err) {
                console.error('Erro ao carregar contact.json', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const save = async () => {
        if (!config) return;
        setSaving(true);
        triggerToast('Sincronizando contato...', 'progress');
        try {
            const res = await githubApi('write', 'src/data/contact.json', {
                content: JSON.stringify(config, null, 4),
                sha: fileSha
            });
            setFileSha(res.sha);
            triggerToast('Dados de Contato atualizados!', 'success');
        } catch (err: any) {
            triggerToast(`Erro ao salvar: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !config) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto w-10 h-10 text-violet-500 mb-4" /> Carregando Canais...</div>;

    const inputClass = "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm";
    const labelClass = "block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest";

    return (
        <div className="max-w-4xl space-y-8 pb-32">
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-4 z-40">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Canais de Contato</h2>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Mapeamento dinâmico</p>
                </div>
                <button onClick={save} disabled={saving} className="bg-violet-600 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-violet-700 shadow-xl shadow-violet-600/20 active:scale-95 transition-all disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Publicando...' : 'Publicar'}
                </button>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8">
                <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                    <AlertCircle className="w-6 h-6 text-orange-500 shrink-0" />
                    <div className="text-xs text-orange-800 leading-relaxed font-medium">
                        <p className="font-bold mb-1 uppercase tracking-wider">Atenção com o Mapa:</p>
                        Para o mapa funcionar, o Google Maps exige um link de <strong>Incorporação (Embed)</strong>.<br />
                        No Google Maps: <span className="font-bold text-orange-950 italic">Compartilhar &gt; Incorporar um mapa &gt; copiar apenas o link dentro de 'src="..."'</span>.
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8 pt-4">
                    <div className="md:col-span-2">
                        <label className={labelClass}><MapPin className="inline w-3 h-3 mr-1" /> Endereço Completo</label>
                        <input type="text" value={config.address} onChange={e => setConfig({ ...config, address: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}><Phone className="inline w-3 h-3 mr-1" /> Telefone de Contato</label>
                        <input type="text" value={config.phone} onChange={e => setConfig({ ...config, phone: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}><Mail className="inline w-3 h-3 mr-1" /> E-mail de Suporte</label>
                        <input type="email" value={config.email} onChange={e => setConfig({ ...config, email: e.target.value })} className={inputClass} />
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}><Info className="inline w-3 h-3 mr-1" /> Título do Formulário</label>
                        <input type="text" value={config.formTitle} onChange={e => setConfig({ ...config, formTitle: e.target.value })} className={inputClass} />
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}><Map className="inline w-4 h-4 mr-1 text-violet-500" /> Link de Incorporação (Embed URL)</label>
                        <textarea rows={3} value={config.googleMapsUrl} onChange={e => setConfig({ ...config, googleMapsUrl: e.target.value })} className={`${inputClass} font-mono text-[10px]`} placeholder="Cole aqui o link (src) do iframe do Google Maps" />
                        <p className="mt-2 text-[9px] text-slate-400 italic">O link deve começar com https://www.google.com/maps/embed?...</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
