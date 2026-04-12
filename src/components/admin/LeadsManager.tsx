import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, Calendar, Trash2, Loader2, User, Info, AlertCircle } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from './CmsToaster';

export default function LeadsManager() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [fileSha, setFileSha] = useState('');

    useEffect(() => {
        loadLeads();
    }, []);

    async function loadLeads() {
        try {
            const data = await githubApi('read', 'src/data/leads.json');
            setLeads(JSON.parse(data.content));
            setFileSha(data.sha);
        } catch (err) {
            console.error('Erro ao carregar leads', err);
        } finally {
            setLoading(false);
        }
    }

    const deleteLead = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este lead?')) return;
        setDeleting(id);
        try {
            const newList = leads.filter(l => l.id !== id);
            const res = await githubApi('write', 'src/data/leads.json', {
                content: JSON.stringify(newList, null, 2),
                sha: fileSha
            });
            setLeads(newList);
            setFileSha(res.sha);
            triggerToast('Lead excluído!', 'success');
        } catch (err: any) {
            triggerToast('Erro ao excluir lead: ' + err.message, 'error');
        } finally {
            setDeleting(null);
        }
    };

    if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto w-10 h-10 text-violet-500" /></div>;

    return (
        <div className="space-y-6">
            {leads.length === 0 ? (
                <div className="bg-white p-20 text-center rounded-2xl border border-dashed border-slate-200">
                    <Mail className="mx-auto w-12 h-12 text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">Nenhum lead capturado ainda.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data / Tipo</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lead</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mensagem</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {leads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                                                <Calendar className="w-3 h-3 text-slate-400" />
                                                {new Date(lead.date).toLocaleDateString('pt-BR')}
                                            </span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase ${lead.type === 'newsletter' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                {lead.type === 'newsletter' ? <Mail className="w-2.5 h-2.5 mr-1" /> : <MessageSquare className="w-2.5 h-2.5 mr-1" />}
                                                {lead.type === 'newsletter' ? 'Newsletter' : 'Contato'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-0.5">
                                                <User className="w-3 h-3 text-slate-400" />
                                                {lead.name || 'Anônimo'}
                                            </span>
                                            <span className="text-xs text-slate-500 font-medium">{lead.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 max-w-md">
                                        <p className="text-xs font-bold text-slate-800 mb-1">{lead.subject}</p>
                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                            {lead.message || <span className="italic opacity-50">Sem conteúdo</span>}
                                        </p>
                                    </td>
                                    <td className="px-6 py-5 text-right whitespace-nowrap">
                                        <button
                                            onClick={() => deleteLead(lead.id)}
                                            disabled={deleting === lead.id}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            title="Excluir Lead"
                                        >
                                            {deleting === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
