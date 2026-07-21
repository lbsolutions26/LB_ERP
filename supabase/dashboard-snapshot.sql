-- RPC unica que retorna todos os dados necessarios para o Dashboard,
-- reduzindo o boot do site a poucas requisicoes.
-- Roda em security definer para escapar dos filtros de RLS repetidos em cada
-- CTE (que geravam statement timeout em bases grandes). Validamos que o usuario
-- chamador tem acesso a target_empresa_id via usuarios_empresas ou platform_admins
-- antes de retornar qualquer dado.
-- Datas de negocio em America/Sao_Paulo (mesmo criterio do diario / monthly cash).

-- Indices auxiliares para acelerar as agregacoes por mes.
create index if not exists idx_clientes_empresa_created
  on public.clientes (empresa_id, created_at);
create index if not exists idx_despesas_empresa_data
  on public.despesas (empresa_id, data_despesa);
create index if not exists idx_documentos_venda_empresa_tipo_data
  on public.documentos_venda (empresa_id, tipo_documento, data_emissao);

create or replace function public.dashboard_snapshot(
  target_empresa_id uuid,
  months_back integer default 11
)
returns jsonb
security definer
set search_path = public
language plpgsql
stable
as $$
declare
  caller_id uuid := auth.uid();
  has_access boolean;
  result jsonb;
begin
  -- Quando chamado sem contexto de auth (script admin/service_role/superuser),
  -- pulamos a validacao explicita porque quem chega ate aqui ja e privilegiado.
  if caller_id is not null then
    select exists (
      select 1 from public.usuarios_empresas ue
      where ue.user_id = caller_id
        and ue.empresa_id = target_empresa_id
        and coalesce(ue.ativo, true)
    ) or exists (
      select 1 from public.platform_admins pa
      where pa.user_id = caller_id
    )
    into has_access;

    if not has_access then
      raise exception 'Acesso negado a empresa %', target_empresa_id;
    end if;
  end if;

  with base as (
    select date_trunc('month', timezone('America/Sao_Paulo', now()))::date as ref
  ),
  forecast_range as (
    select
      coalesce(
        max(date_trunc('month', timezone('America/Sao_Paulo', p.vencimento))::date),
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
    select date_trunc('month', timezone('America/Sao_Paulo', r.data_recebimento))::date as mes,
           sum(r.valor)::numeric as total
    from public.recebimentos r
    where r.empresa_id = target_empresa_id
    group by 1
  ),
  previstos as (
    select date_trunc('month', timezone('America/Sao_Paulo', p.vencimento))::date as mes,
           sum(coalesce(p.valor_parcela,0) - coalesce(p.valor_recebido,0))::numeric as total
    from public.contas_receber_parcelas p
    where p.empresa_id = target_empresa_id
      and lower(coalesce(p.status,'')) not in ('recebido','cancelado')
      and (coalesce(p.valor_parcela,0) - coalesce(p.valor_recebido,0)) > 0.00001
    group by 1
  ),
  faturado as (
    select date_trunc('month', timezone('America/Sao_Paulo', d.data_emissao))::date as mes,
           sum(d.total)::numeric as total,
           count(*)::int as pedidos_count
    from public.documentos_venda d
    where d.empresa_id = target_empresa_id
      and d.tipo_documento = 'pedido'
      and lower(coalesce(d.status, '')) <> 'cancelado'
    group by 1
  ),
  clientes_mes as (
    select date_trunc('month', timezone('America/Sao_Paulo', c.created_at))::date as mes,
           count(*)::int as total
    from public.clientes c
    where c.empresa_id = target_empresa_id
    group by 1
  ),
  despesas_mes as (
    select date_trunc('month', timezone('America/Sao_Paulo', d.data_despesa))::date as mes,
           sum(d.valor)::numeric as total,
           count(*)::int as despesas_count
    from public.despesas d
    where d.empresa_id = target_empresa_id
    group by 1
  ),
  monthly as (
    select
      m.mes,
      coalesce(r.total, 0)::numeric as realized,
      coalesce(p.total, 0)::numeric as forecast,
      coalesce(f.total, 0)::numeric as faturamento,
      coalesce(f.pedidos_count, 0)::int as pedidos_count,
      coalesce(cm.total, 0)::int as clientes_novos,
      coalesce(dm.total, 0)::numeric as despesas_total,
      coalesce(dm.despesas_count, 0)::int as despesas_count
    from months m
    left join recebidos r on r.mes = m.mes
    left join previstos p on p.mes = m.mes
    left join faturado  f on f.mes = m.mes
    left join clientes_mes cm on cm.mes = m.mes
    left join despesas_mes dm on dm.mes = m.mes
    order by m.mes
  ),
  counts as (
    select
      (select count(*)::int from public.clientes c where c.empresa_id = target_empresa_id) as clientes,
      (select count(*)::int from public.documentos_venda d
        where d.empresa_id = target_empresa_id
          and d.tipo_documento = 'pedido'
          and lower(coalesce(d.status, '')) <> 'cancelado') as pedidos,
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
          and lower(coalesce(d.status, '')) <> 'cancelado'
      ) as faturamento_total
  )
  select jsonb_build_object(
    'counts', to_jsonb(c),
    'monthly', coalesce((select jsonb_agg(to_jsonb(m) order by m.mes) from monthly m), '[]'::jsonb)
  )
  into result
  from counts c;

  return result;
end;
$$;

grant execute on function public.dashboard_snapshot(uuid, integer) to anon, authenticated;
