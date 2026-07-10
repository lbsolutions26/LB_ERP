-- Finalizacao da importacao de itens (rodar apos todas as partes)
insert into public.documento_venda_itens (
  empresa_id, documento_id, produto_id, descricao_item, quantidade, valor_unitario, valor_total, custo_unitario, custo_total, margem_percentual, raw_payload
)
select
  r.empresa_id,
  d.id as documento_id,
  coalesce(p_by_id.id, case when p_by_name.cnt = 1 then p_by_name.id else null end) as produto_id,
  coalesce(nullif(btrim(r.produto_nome_raw), ''), 'Item legado sem descricao') as descricao_item,
  coalesce(public.parse_numeric_br(r.quantidade_raw), 1) as quantidade,
  coalesce(public.parse_numeric_br(r.valor_unitario_raw), 0) as valor_unitario,
  coalesce(public.parse_numeric_br(r.total_raw), coalesce(public.parse_numeric_br(r.quantidade_raw), 1) * coalesce(public.parse_numeric_br(r.valor_unitario_raw), 0)) as valor_total,
  public.parse_numeric_br(r.custo_unitario_raw) as custo_unitario,
  public.parse_numeric_br(r.custo_total_raw) as custo_total,
  public.parse_percent_numeric_br(r.margem_raw) as margem_percentual,
  r.payload || jsonb_build_object('source_row_num', r.source_row_num, 'source_item_id', r.source_item_id)
from public.vendas_itens_import_raw r
join public.documentos_venda d
  on d.empresa_id = r.empresa_id
 and d.origem = 'legacy_sheet'
 and d.origem_legacy_id = nullif(btrim(r.pedido_legacy_id_raw), '')
 and d.tipo_documento = case when lower(coalesce(btrim(r.tipo_venda_raw), 'pedido')) = 'orçamento' then 'orcamento' else 'pedido' end
left join public.produto_catalogo p_by_id
  on p_by_id.empresa_id = r.empresa_id
 and p_by_id.external_id = nullif(btrim(r.produto_legacy_id_raw), '')
left join lateral (
  select min(p.id) as id, count(*) as cnt
  from public.produto_catalogo p
  where p.empresa_id = r.empresa_id
    and lower(btrim(p.nome)) = lower(btrim(r.produto_nome_raw))
) p_by_name on true
where r.lote_ref = 'itens_vendas_2026_07_10'
  and not exists (
    select 1
    from public.documento_venda_itens i
    where i.documento_id = d.id
      and i.raw_payload ->> 'source_item_id' = r.source_item_id
  );

-- Conferencia
select count(*) as itens_importados
from public.documento_venda_itens i
where i.raw_payload ->> 'source_item_id' is not null;

select
  d.id as documento_id,
  d.tipo_documento,
  count(i.id) as total_itens
from public.documentos_venda d
left join public.documento_venda_itens i on i.documento_id = d.id
where d.empresa_id = (select id from public.empresas where nome = 'GuPedal' limit 1)
group by d.id, d.tipo_documento
order by d.id desc
limit 50;
