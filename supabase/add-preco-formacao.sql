-- Snapshot da formacao de preco do produto (calculadora).
alter table public.produto_catalogo
  add column if not exists preco_formacao jsonb;

comment on column public.produto_catalogo.preco_formacao is
  'Snapshot editavel da calculadora de preco de venda (custos fixos + percentuais + preco sugerido).';
