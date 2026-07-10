-- Importacao da tabela legado de tipos de pagamento
-- Fonte: Google Sheets (gid=2006966907)

with e as (
  select id
  from public.empresas
  where nome = 'GuPedal'
  limit 1
), src(id_legacy, nome, taxa_raw) as (
  values
    ('1', 'Dinheiro', null),
    ('2', 'PIX', null),
    ('3', 'Debito', '1,93%'),
    ('4', 'Credito', '4,70%'),
    ('5', 'Parcelado', null)
)
insert into public.formas_pagamento (
  empresa_id,
  id_legacy,
  nome,
  tipo,
  taxa_percentual,
  configuracoes,
  ativo
)
select
  e.id,
  src.id_legacy,
  src.nome,
  case
    when lower(src.nome) = 'dinheiro' then 'dinheiro'
    when lower(src.nome) = 'pix' then 'pix'
    when lower(src.nome) = 'debito' then 'cartao_debito'
    when lower(src.nome) = 'credito' then 'cartao_credito'
    when lower(src.nome) = 'parcelado' then 'parcelado'
    else 'outro'
  end as tipo,
  public.parse_percent_numeric_br(src.taxa_raw) as taxa_percentual,
  jsonb_build_object(
    'taxa_raw', src.taxa_raw,
    'origem', 'legado'
  ) as configuracoes,
  true as ativo
from e
cross join src
on conflict (empresa_id, nome)
do update set
  id_legacy = excluded.id_legacy,
  tipo = excluded.tipo,
  taxa_percentual = excluded.taxa_percentual,
  configuracoes = excluded.configuracoes,
  ativo = true;
