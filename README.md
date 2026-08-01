# GuPedal SaaS Web

Base SaaS multiempresa para migrar seu AppSheet para web usando HTML, CSS, JavaScript e Supabase.

## Menus implementados

- Dashboard
- Clientes
- Pedidos
- Orcamentos
- Despesas
- Produtos
- Usuarios (visivel para role owner da empresa)
- Relatorios
- Admin SaaS (apenas platform admin)

## Modelo multiempresa

- Todas as tabelas de negocio tem `empresa_id`.
- O usuario loga via Supabase Auth.
- O acesso e filtrado por RLS usando o vinculo em `usuarios_empresas`.

## 1) Configurar banco no Supabase

1. Abra o SQL Editor do Supabase.
2. Execute o script de [supabase-schema.sql](supabase-schema.sql).

## 2) Criar tenant e usuario (Admin SaaS)

Promova um usuario para administrar a plataforma (aba **Admin SaaS**):

```sql
insert into public.platform_admins (user_id)
values ('UUID_DO_AUTH_USER')
on conflict (user_id) do nothing;
```

Com a aba **Admin SaaS** (somente platform admin):

1. **Empresas** — lista todos os tenants, busca, edita contato e ve usuarios de cada uma.
2. **Usuarios** — lista vinculos com e-mail, perfil e status; ativa/desativa e troca role.
3. **Vender acesso** — fluxo guiado: cria a empresa + owner em um passo e mostra os dados para entregar ao cliente.
4. Atalhos **Nova empresa** / **Novo usuario** abrem modais (criar no Auth ou so vincular).

Requisito na Vercel para criar usuarios e listar e-mails:

- `SUPABASE_SERVICE_ROLE_KEY` (alem de `SUPABASE_URL` e `SUPABASE_ANON_KEY`)

Fallback manual (SQL), se precisar:

```sql
insert into public.empresas (nome) values ('Nome da Empresa');

insert into public.usuarios_empresas (user_id, empresa_id, role)
values ('UUID_DO_AUTH_USER', 'UUID_DA_EMPRESA', 'owner');
```

## Owner criando usuarios da propria empresa

- O usuario com role `owner` ve a aba `Usuarios`.
- Ele pode criar novos usuarios apenas para a empresa dele.
- Nao existe selecao de empresa nessa tela (isolamento automatico).

## 3) Configurar credenciais

Opcao A (local):

1. Edite [config.js](config.js).
2. Preencha:

```js
window.SUPABASE_CONFIG = {
  SAAS_NAME: "LB ERP SaaS",
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "SUA_ANON_KEY"
};
```

Opcao B (Vercel):

1. Configure no projeto da Vercel:
  - SAAS_NAME
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY (necessaria para Admin SaaS criar usuarios)
2. O frontend carregara automaticamente via [api/public-config.js](api/public-config.js).

## 4) Rodar o app

Como e um app estatico, voce pode abrir [index.html](index.html) no navegador.

Se preferir servidor local:

```powershell
npx serve .
```

## 5) Publicar com GitHub + Vercel

1. Crie um repositorio no GitHub e envie este projeto.
2. Na Vercel, clique em New Project e importe o repositorio.
3. Em Environment Variables, adicione SUPABASE_URL e SUPABASE_ANON_KEY.
  Opcional: SAAS_NAME para personalizar a marca do topo/login.
  Para habilitar criacao de usuarios no Admin SaaS, adicione SUPABASE_SERVICE_ROLE_KEY.
4. Deploy.

Fluxo recomendado:

- Branch main: producao
- Branch develop: homologacao
- Preview Deploy da Vercel por Pull Request

## Observacoes

- Este primeiro corte foca no backoffice principal e isolamento por empresa.
- Se quiser, no proximo passo eu separo em duas aplicacoes:
  - Admin SaaS (sua equipe) para criar empresas e vender login.
  - Portal Cliente (cada empresa) para operar o ERP.

## Fluxo com agente (Copilot)

- Sempre que eu pedir uma alteracao de codigo, o agente deve:
  1. aplicar as mudancas;
  2. fazer commit dos arquivos da tarefa;
  3. fazer push para o GitHub sem eu precisar pedir novamente.
- Se houver arquivos locais nao relacionados ja modificados, o commit deve incluir apenas os arquivos da tarefa atual.

## Acesso automatizado ao schema do Supabase

Para permitir que o agente leia a estrutura real do banco sempre que voce quiser:

1. Copie `.env.example` para `.env`.
2. Preencha `SUPABASE_DB_URL` com a connection string do Postgres do Supabase.
3. Execute:

```powershell
npm install
npm run schema:pull
```

Ou rode o setup guiado (recomendado):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-supabase-schema-access.ps1
```

Arquivos gerados:

- `supabase/live-schema.json` (completo para analise)
- `supabase/live-schema.md` (resumo legivel)

Depois de gerar esses arquivos, o agente consegue revisar tabelas, colunas, FKs, indices e politicas RLS com base no estado atual do banco.
