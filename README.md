# cms-core

Base clonável para blogs com CMS completo. Inclui admin, API CRUD, auth e 14 plugins pré-instalados. Traga seu design.

## O que é

O **cms-core** é uma base de blog com toda a infraestrutura CMS já configurada:

- Painel admin completo (28 páginas)
- 15 API routes (posts, config, auth, plugins...)
- 14 plugins pré-instalados via slot system
- Auth com sessão segura
- Layout genérico com Tailwind CSS (sem dependência de tema)

**Workflow:** Clonar → configurar `.env` → conectar repo GitHub → trazer seu design → deploy.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/8linksapp-maker/cms-core.git meu-blog
cd meu-blog

# 2. Instale as dependências
bun install

# 3. Configure o ambiente
cp .env.example .env
# Edite .env com seu ADMIN_SECRET e credenciais GitHub

# 4. Configure o tema
# Edite src/lib/templateConfig.ts com o nome do seu repo
# Edite src/data/siteConfig.json com nome, url, cores

# 5. Dev
bun dev

# 6. Deploy (Vercel recomendado)
vercel
```

## O que já vem incluído

### 14 Plugins pré-instalados

| Plugin | Descrição |
|--------|-----------|
| Google Analytics | Tag GA4 no head |
| Meta Pixel | Pixel do Facebook |
| AdSense | Script de anúncios |
| SEO / Schema | JSON-LD Article, BreadcrumbList, WebSite |
| Social Share | Botões de compartilhamento (7 redes) |
| Cookie Consent | Banner LGPD/GDPR |
| Related Posts | Posts relacionados ao final do artigo |
| Email List | Popup + banner inline + widget sidebar + sequências |
| Affiliates | Cards de produtos com Amazon, ML, etc. |
| Redirects | Redirecionamentos 301/302 via JSON |
| AI Writer | Geração de posts com OpenAI + Pexels |
| Search Console | Verificação + métricas GSC |
| Import WordPress | Importação de XML do WP |
| Plugin Updater | Atualização de plugins via PluginsHub |

### Infraestrutura incluída

- `src/pages/admin/` — 28 páginas de admin
- `src/pages/api/` — 15 API routes
- `src/plugins/` — 14 plugins + 5 slot aggregators
- `src/components/admin/` — 15 componentes React
- `src/middleware.ts` — auth middleware
- `src/lib/auth.ts`, `adminApi.ts`, `readData.ts`

## O que customizar vs. o que não tocar

| O que customizar | O que NÃO tocar |
|-----------------|-----------------|
| `src/layouts/BaseLayout.astro` | `src/pages/admin/` |
| `src/pages/index.astro` | `src/pages/api/` |
| `src/pages/blog/` | `src/plugins/` |
| `src/components/layout/` | `src/middleware.ts` |
| `src/components/sidebar/` | `src/lib/auth.ts` |
| `src/data/siteConfig.json` | `src/data/pluginVersions.json` |
| `src/data/pluginsConfig.json` (via admin) | `src/data/pluginRegistry.json` |
| `public/` (CSS, imagens, JS) | — |

## Variáveis de ambiente

```env
ADMIN_SECRET=        # Senha do painel admin
GITHUB_TOKEN=        # Token GitHub com permissão de escrita (produção)
GITHUB_OWNER=        # Seu usuário/organização no GitHub
GITHUB_REPO=         # Nome do repositório deste site
```

Em desenvolvimento, os dados são gravados localmente. Em produção (Vercel), o token GitHub é necessário para persistir dados via GitHub API.

## Configuração do template

Edite `src/lib/templateConfig.ts`:

```ts
export const TEMPLATE_REPO = '';         // deixe vazio ou o repo de onde veio
export const TEMPLATE_NAME = 'cms-core';
export const PLUGINS_REPO = '8linksapp-maker/cms-plugins';
```

## Links úteis

- [cms-plugins](https://github.com/8linksapp-maker/cms-plugins) — repositório com os 14 plugins
- [admin-ui-boilerplate](https://github.com/8linksapp-maker/admin-ui-boilerplate) — boilerplate do painel admin
