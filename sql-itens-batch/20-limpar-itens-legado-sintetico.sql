with removidos as (
  delete from public.documento_venda_itens i
  using public.documentos_venda d
  where i.documento_id = d.id
    and d.origem = 'legacy_sheet'
    and d.origem_legacy_id is not null
    and i.descricao_item = 'Item legado sem descricao'
    and round(coalesce(i.valor_total, 0), 2) = round(coalesce(d.total, 0), 2)
  returning i.id, i.documento_id, i.valor_total
)
select
  count(*) as itens_removidos
from removidos;