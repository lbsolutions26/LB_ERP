-- Retorna faturamento e numero de pedidos dia a dia para o mes corrente.
-- Usado nos graficos "Faturamento por Dia" e "Pedidos por Dia" do dashboard.
-- Datas de negocio em America/Sao_Paulo (alinhado com dashboard_monthly_cash / snapshot).
create or replace function public.dashboard_daily_current_month(
  target_empresa_id uuid
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
  -- Limites do mes civil no fuso de negocio (Brasil).
  ref_start date := date_trunc('month', timezone('America/Sao_Paulo', now()))::date;
  ref_end date := (date_trunc('month', timezone('America/Sao_Paulo', now())) + interval '1 month' - interval '1 day')::date;
  result jsonb;
begin
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

  with days as (
    select generate_series(ref_start, ref_end, interval '1 day')::date as dia
  ),
  agg as (
    select
      timezone('America/Sao_Paulo', d.data_emissao)::date as dia,
      sum(d.total)::numeric as faturamento,
      count(*)::int as pedidos_count
    from public.documentos_venda d
    where d.empresa_id = target_empresa_id
      and d.tipo_documento = 'pedido'
      and lower(coalesce(d.status, '')) <> 'cancelado'
      and timezone('America/Sao_Paulo', d.data_emissao)::date >= ref_start
      and timezone('America/Sao_Paulo', d.data_emissao)::date <= ref_end
    group by 1
  ),
  daily as (
    select
      days.dia,
      coalesce(agg.faturamento, 0)::numeric as faturamento,
      coalesce(agg.pedidos_count, 0)::int as pedidos_count
    from days
    left join agg on agg.dia = days.dia
    order by days.dia
  )
  select jsonb_agg(to_jsonb(daily) order by daily.dia)
  into result
  from daily;

  return coalesce(result, '[]'::jsonb);
end;
$$;

grant execute on function public.dashboard_daily_current_month(uuid) to anon, authenticated;
