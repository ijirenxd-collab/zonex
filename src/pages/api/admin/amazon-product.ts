/**
 * amazon-product.ts — Proxy para Amazon PA-API 5.0
 *
 * Busca dados de produto pelo ASIN usando AWS Signature V4.
 * Env vars necessárias:
 *   AMAZON_ACCESS_KEY  — chave de acesso do Associates
 *   AMAZON_SECRET_KEY  — chave secreta do Associates
 *   AMAZON_PARTNER_TAG — tag de afiliado (ex: meutag-20)
 */
import type { APIRoute } from 'astro';
import crypto from 'node:crypto';

export const prerender = false;

const SERVICE = 'ProductAdvertisingAPI';
const REGION = 'us-east-1';
const HOST = 'webservices.amazon.com.br';
const PATH = '/paapi5/getitems';
const TARGET = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems';

function hmac(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256hex(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function signingKey(secret: string, date: string): Buffer {
    const kDate    = hmac('AWS4' + secret, date);
    const kRegion  = hmac(kDate, REGION);
    const kService = hmac(kRegion, SERVICE);
    return hmac(kService, 'aws4_request');
}

export const POST: APIRoute = async ({ request }) => {
    const body = await request.json().catch(() => ({}));

    const accessKey  = body.accessKey  || import.meta.env.AMAZON_ACCESS_KEY;
    const secretKey  = body.secretKey  || import.meta.env.AMAZON_SECRET_KEY;
    const partnerTag = body.partnerTag || import.meta.env.AMAZON_PARTNER_TAG;

    if (!accessKey || !secretKey || !partnerTag) {
        return new Response(
            JSON.stringify({ error: 'Configure as credenciais PA-API nas Configurações do plugin ou como variáveis de ambiente.' }),
            { status: 500 }
        );
    }

    const { asin } = body;
    if (!asin) {
        return new Response(JSON.stringify({ error: 'ASIN obrigatório' }), { status: 400 });
    }

    const cleanAsin = String(asin).trim().toUpperCase();

    const payload = JSON.stringify({
        ItemIds: [cleanAsin],
        Resources: [
            'Images.Primary.Large',
            'ItemInfo.Title',
            'ItemInfo.Features',
            'Offers.Listings.Price',
            'Offers.Listings.SavingBasis',
            'CustomerReviews.StarRating',
        ],
        PartnerTag: partnerTag,
        PartnerType: 'Associates',
        Marketplace: 'www.amazon.com.br',
    });

    // Timestamps
    const now = new Date();
    const amzDate   = now.toISOString().replace(/[-:]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);

    const contentType = 'application/json; charset=UTF-8';
    const bodyHash = sha256hex(payload);

    // Canonical request
    const canonicalHeaders =
        `content-encoding:amz-1.0\n` +
        `content-type:${contentType}\n` +
        `host:${HOST}\n` +
        `x-amz-date:${amzDate}\n` +
        `x-amz-target:${TARGET}\n`;

    const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';

    const canonicalRequest = [
        'POST', PATH, '',
        canonicalHeaders,
        signedHeaders,
        bodyHash,
    ].join('\n');

    // String to sign
    const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        sha256hex(canonicalRequest),
    ].join('\n');

    // Signature
    const signature = hmac(signingKey(secretKey, dateStamp), stringToSign).toString('hex');
    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    try {
        const res = await fetch(`https://${HOST}${PATH}`, {
            method: 'POST',
            headers: {
                'content-encoding': 'amz-1.0',
                'content-type': contentType,
                'host': HOST,
                'x-amz-date': amzDate,
                'x-amz-target': TARGET,
                'Authorization': authHeader,
            },
            body: payload,
        });

        const data = await res.json();

        if (!res.ok) {
            const msg = data.__type?.split('#').pop() ?? `Erro ${res.status}`;
            return new Response(JSON.stringify({ error: msg }), { status: res.status });
        }

        const item = data.ItemsResult?.Items?.[0];
        if (!item) {
            return new Response(JSON.stringify({ error: 'Produto não encontrado na Amazon Brasil' }), { status: 404 });
        }

        const features: string[] = item.ItemInfo?.Features?.DisplayValues ?? [];

        return new Response(JSON.stringify({
            title:         item.ItemInfo?.Title?.DisplayValue ?? '',
            image:         item.Images?.Primary?.Large?.URL ?? '',
            price:         item.Offers?.Listings?.[0]?.Price?.DisplayAmount ?? '',
            originalPrice: item.Offers?.Listings?.[0]?.SavingBasis?.DisplayAmount ?? '',
            rating:        item.CustomerReviews?.StarRating?.Value ?? 0,
            features,
            amazonUrl: `https://www.amazon.com.br/dp/${cleanAsin}?tag=${partnerTag}`,
        }), { status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
