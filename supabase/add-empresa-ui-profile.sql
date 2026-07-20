-- Perfil de uso da empresa: tipo de negocio + preferencias de UI.
-- Rode no SQL Editor do Supabase se as colunas ainda nao existirem.

alter table public.empresas
  add column if not exists tipo_empresa text default 'oficina',
  add column if not exists ui_config jsonb default '{}'::jsonb;

comment on column public.empresas.tipo_empresa is
  'Perfil do negocio: oficina | mercadinho | generico. Define defaults de home, menu e modo de venda.';
comment on column public.empresas.ui_config is
  'Overrides de UI: { home_section, modo_venda, show_orcamentos, pedido_label, pedidos_label, default_pedido_status, cliente_obrigatorio }';

-- Valores legados: se null, trata como oficina no app.
update public.empresas
set tipo_empresa = coalesce(nullif(trim(tipo_empresa), ''), 'oficina')
where tipo_empresa is null or trim(tipo_empresa) = '';
