import type { APIRoute } from 'astro';
import { readFileFromRepo, writeFileToRepo } from '../../plugins/_server';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { type, email, name, subject, message, source = 'website' } = body;

        if (type === 'newsletter') {
            let subscribers: any[] = [];
            try {
                const raw = await readFileFromRepo('src/data/subscribers.json');
                subscribers = raw ? JSON.parse(raw) : [];
            } catch {
                subscribers = [];
            }

            const newSubscriber = {
                email,
                name: name || '',
                subscribedAt: new Date().toISOString(),
                source: source || 'widget',
                tags: ['newsletter']
            };

            // Evitar duplicatas simples por email
            if (!subscribers.find(s => s.email === email)) {
                subscribers.unshift(newSubscriber);
                await writeFileToRepo(
                    'src/data/subscribers.json',
                    JSON.stringify(subscribers, null, 2),
                    { message: `Email List: new subscriber ${email}` }
                );
            }
        } else {
            let leads: any[] = [];
            try {
                const raw = await readFileFromRepo('src/data/leads.json');
                leads = raw ? JSON.parse(raw) : [];
            } catch {
                leads = [];
            }

            const newLead = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                type: 'contact',
                email,
                name,
                subject: subject || 'Mensagem de Contato',
                message: message || ''
            };

            leads.unshift(newLead);
            await writeFileToRepo(
                'src/data/leads.json',
                JSON.stringify(leads, null, 2),
                { message: `Lead: new contact from ${email}` }
            );
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
