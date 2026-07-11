-- Indices auxiliares para acelerar a RPC dashboard_monthly_cash.

create index if not exists idx_documentos_venda_empresa_data
  on public.documentos_venda (empresa_id, data_emissao);

create index if not exists idx_documentos_venda_empresa_tipo_data
  on public.documentos_venda (empresa_id, tipo_documento, data_emissao);

create index if not exists idx_contas_receber_parcelas_empresa_status_vencimento
  on public.contas_receber_parcelas (empresa_id, status, vencimento);

create index if not exists idx_recebimentos_empresa_data
  on public.recebimentos (empresa_id, data_recebimento);

-- Reescreve a funcao com filtros mais estreitos.
create or replace function public.dashboard_monthly_cash(
  target_empresa_id uuid,
  months_back integer default 11
)
returns table (
  mes date,
  realized_recebimentos numeric,
  forecast_parcelas numeric,
  faturamento numeric
)
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
  )
  select
    m.mes,
    coalesce(r.total, 0) as realized_recebimentos,
    coalesce(p.total, 0) as forecast_parcelas,
    coalesce(f.total, 0) as faturamento
  from months m
  left join recebidos r on r.mes = m.mes
  left join previstos p on p.mes = m.mes
  left join faturado f on f.mes = m.mes
  order by m.mes;
$$;

grant execute on function public.dashboard_monthly_cash(uuid, integer) to anon, authenticated;
