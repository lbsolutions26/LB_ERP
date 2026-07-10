# GuPedal SaaS Web

Base SaaS multiempresa para migrar seu AppSheet para web usando HTML, CSS, JavaScript e Supabase.

## Menus implementados

- Dashboard
- Clientes
- Pedidos
- Orcamentos
- Despesas
- Produtos
- Relatorios

## Modelo multiempresa

- Todas as tabelas de negocio tem `empresa_id`.
- O usuario loga via Supabase Auth.
- O acesso e filtrado por RLS usando o vinculo em `usuarios_empresas`.

## 1) Configurar banco no Supabase

1. Abra o SQL Editor do Supabase.
2. Execute o script de [supabase-schema.sql](supabase-schema.sql).

## 2) Criar tenant e usuario

1. Crie uma empresa na tabela `empresas`.
2. Crie um usuario no painel Auth do Supabase (email/senha).
3. Vincule usuario + empresa na tabela `usuarios_empresas`.

Exemplo de vinculo:

```sql
insert into public.usuarios_empresas (user_id, empresa_id, role)
values ('UUID_DO_AUTH_USER', 'UUID_DA_EMPRESA', 'owner');
```

## 3) Configurar credenciais

Opcao A (local):

1. Edite [config.js](config.js).
2. Preencha:

```js
window.SUPABASE_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "SUA_ANON_KEY"
};
```

Opcao B (Vercel):

1. Configure no projeto da Vercel:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
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
