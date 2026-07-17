-- Configuracao da empresa para PDF / identidade visual (por tenant).
-- Rode no SQL Editor do Supabase se as colunas ainda nao existirem.

alter table public.empresas
  add column if not exists telefone text,
  add column if not exists email text,
  add column if not exists endereco text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists logo_path text,
  add column if not exists cor_primaria text default '#165d59',
  add column if not exists pdf_termos text,
  add column if not exists pdf_aviso text,
  add column if not exists doc_extra_config jsonb;

comment on column public.empresas.telefone is 'Telefone exibido no PDF e documentos';
comment on column public.empresas.email is 'E-mail de contato da empresa';
comment on column public.empresas.endereco is 'Endereco (rua/numero) da empresa';
comment on column public.empresas.bairro is 'Bairro da empresa';
comment on column public.empresas.cidade is 'Cidade da empresa';
comment on column public.empresas.uf is 'UF da empresa (2 letras)';
comment on column public.empresas.logo_path is 'Caminho/URL do logo no storage (ex.: produto-images/...)';
comment on column public.empresas.cor_primaria is 'Cor primaria (hex) usada no PDF e identidade';
comment on column public.empresas.pdf_termos is 'Termos e condicoes do orcamento/pedido (texto multilinha)';
comment on column public.empresas.pdf_aviso is 'Aviso de atencao exibido no PDF (ex.: prazo de retirada)';
comment on column public.empresas.doc_extra_config is
  'Secao extra do pedido/orcamento: { ativo, titulo, hint, campos:[{id,label,tipo,ativo,placeholder}] }';

-- Membros da empresa podem atualizar a propria configuracao
drop policy if exists "empresas_tenant_update" on public.empresas;
create policy "empresas_tenant_update"
on public.empresas
for update
using (public.user_belongs_to_empresa(id))
with check (public.user_belongs_to_empresa(id));
