-- RPC unica que retorna todos os dados necessarios para o Dashboard,
-- reduzindo o boot do site a poucas requisicoes.
create or replace function public.dashboard_snapshot(
  target_empresa_id uuid,
  months_back integer default 11
)
returns jsonb
security invoker
language sql
stable
as $$
  with base as (
    select date_trunc('month', now())::date as ref
  ),
  forecast_range as (
    select
      coalesce(
        max(date_trunc('month', p.vencimento)::date),
        (select ref from base)
      ) as latest
    from public.contas_receber_parcelas p
    where p.empresa_id = target_empresa_id
      and lower(coalesce(p.status,'')) not in ('recebido','cancelado')
      and (coalesce(p.valor_parcela,0) - coalesce(p.valor_recebido,0)) > 0.00001
  ),
  months as (
    select generate_series(
      (select ref from base) - (months_back || ' months')::interval,
      greatest((select ref from base), (select latest from forecast_range)),
      interval '1 month'
    )::date as mes
  ),
  recebidos as (
    select date_trunc('month', r.data_recebimento)::date as mes,
           sum(r.valor)::numeric as total
    from public.recebimentos r
    where r.empresa_id = target_empresa_id
    group by 1
  ),
  previstos as (
    select date_trunc('month', p.vencimento)::date as mes,
           sum(coalesce(p.valor_parcela,0) - coalesce(p.valor_recebido,0))::numeric as total
    from public.contas_receber_parcelas p
    where p.empresa_id = target_empresa_id
      and lower(coalesce(p.status,'')) not in ('recebido','cancelado')
      and (coalesce(p.valor_parcela,0) - coalesce(p.valor_recebido,0)) > 0.00001
    group by 1
  ),
  faturado as (
    select date_trunc('month', d.data_emissao)::date as mes,
           sum(d.total)::numeric as total
    from public.documentos_venda d
    where d.empresa_id = target_empresa_id
      and d.tipo_documento = 'pedido'
    group by 1
  ),
  monthly as (
    select
      m.mes,
      coalesce(r.total, 0)::numeric as realized,
      coalesce(p.total, 0)::numeric as forecast,
      coalesce(f.total, 0)::numeric as faturamento
    from months m
    left join recebidos r on r.mes = m.mes
    left join previstos p on p.mes = m.mes
    left join faturado  f on f.mes = m.mes
    order by m.mes
  ),
  counts as (
    select
      (select count(*)::int from public.clientes c where c.empresa_id = target_empresa_id) as clientes,
      (select count(*)::int from public.documentos_venda d
        where d.empresa_id = target_empresa_id and d.tipo_documento = 'pedido') as pedidos,
      (select count(*)::int from public.despesas d where d.empresa_id = target_empresa_id) as despesas,
      (select count(*)::int from public.produto_catalogo p where p.empresa_id = target_empresa_id) as produtos_total,
      (
        select count(*)::int from public.produto_catalogo p
        where p.empresa_id = target_empresa_id
          and coalesce(p.controla_estoque, true)
          and coalesce(p.estoque_atual, 0) > 0
      ) as produtos_com_saldo,
      (
        select count(*)::int from public.produto_catalogo p
        where p.empresa_id = target_empresa_id
          and coalesce(p.controla_estoque, true)
          and coalesce(p.estoque_atual, 0) <= coalesce(p.estoque_minimo, 0)
      ) as produtos_ponto_pedido,
      (
        select coalesce(sum(d.total), 0)::numeric from public.documentos_venda d
        where d.empresa_id = target_empresa_id
          and d.tipo_documento = 'orcamento'
          and d.status = 'aberto'
      ) as orcamento_aberto,
      (
        select coalesce(sum(d.total), 0)::numeric from public.documentos_venda d
        where d.empresa_id = target_empresa_id
          and d.tipo_documento = 'pedido'
      ) as faturamento_total
  )
  select jsonb_build_object(
    'counts', to_jsonb(c),
    'monthly', coalesce((select jsonb_agg(to_jsonb(m) order by m.mes) from monthly m), '[]'::jsonb)
  )
  from counts c;
$$;

grant execute on function public.dashboard_snapshot(uuid, integer) to anon, authenticated;
