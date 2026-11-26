-- Exact user-controlled odds: basis points, 10000 = 100%.
-- Existing campaigns keep automatic allocation until the owner saves custom odds.
alter table public.settings add column manual_odds jsonb;
alter table public.settings alter column manual_odds set default '{}'::jsonb;
alter table public.settings add constraint manual_odds_object check(manual_odds is null or jsonb_typeof(manual_odds)='object');
create or replace function public.campaign_weights(p_campaign integer) returns table(prize_id uuid,prize_name text,effective_quantity bigint,tickets numeric) language sql stable security invoker set search_path='' as $$
 with cfg as (select planned_plays,no_win_weight,manual_odds from public.settings where id=p_campaign),
 counts as (select count(*)::numeric n from public.plays where campaign_id=p_campaign and exists(select 1 from cfg where manual_odds is null)),
 stock as (
 select p.id,p.name,p.unlimited,p.fallback_weight,
 case when p.unlimited then null::bigint when p.requires_code then least(p.quantity::bigint,coalesce(v.available,0)) else p.quantity::bigint end as effective
 from public.prizes p left join (select prize_id,count(*) available from public.vouchers where campaign_id=p_campaign and not used group by prize_id) v on v.prize_id=p.id where p.campaign_id=p_campaign
 ),
 totals as (select coalesce(sum(effective),0)::numeric finite_stock,coalesce(sum(fallback_weight) filter(where unlimited),0)::numeric unlimited_weight from stock),
 base as (select greatest(1::numeric,cfg.planned_plays-counts.n,totals.finite_stock) denominator,totals.finite_stock,totals.unlimited_weight+cfg.no_win_weight weight_sum,cfg.no_win_weight from cfg cross join counts cross join totals where cfg.manual_odds is null),
 manual as (select s.id,s.name,s.effective,case when s.unlimited or s.effective>0 then coalesce((cfg.manual_odds->>s.id::text)::numeric,0) else 0::numeric end as weight from stock s cross join cfg where cfg.manual_odds is not null)
 select s.id,s.name,s.effective,case when s.unlimited then (b.denominator-b.finite_stock)*s.fallback_weight else s.effective*b.weight_sum end from stock s cross join base b
 union all select null::uuid,'Chúc may mắn',null::bigint,(denominator-finite_stock)*no_win_weight from base
 union all select id,name,effective,weight from manual
 union all select null::uuid,'Chúc may mắn',null::bigint,10000-coalesce((select sum(weight) from manual),0) from cfg where manual_odds is not null
$$;
create function public.campaign_save_odds(p_campaign integer,p_revision bigint,p_odds jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype; item record; total numeric:=0; count_prizes integer;
begin
 select * into cfg from public.settings where id=p_campaign for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND';end if;
 if cfg.active then raise exception 'PAUSE_CAMPAIGN';end if;
 if cfg.revision is distinct from p_revision then raise exception 'STALE_CONFIG';end if;
 if p_odds is null or jsonb_typeof(p_odds)<>'object' then raise exception 'INVALID_ODDS';end if;
 select count(*) into count_prizes from public.prizes where campaign_id=p_campaign;
 if (select count(*) from jsonb_object_keys(p_odds))<>count_prizes then raise exception 'STALE_CONFIG';end if;
 for item in select key,value from jsonb_each(p_odds) loop
  if jsonb_typeof(item.value)<>'number' or item.value::text !~ '^[0-9]{1,5}$' or not exists(select 1 from public.prizes where campaign_id=p_campaign and id::text=item.key) then raise exception 'INVALID_ODDS';end if;
  if item.value::text::numeric>10000 then raise exception 'INVALID_ODDS';end if;
  total:=total+item.value::text::numeric;
 end loop;
 if total>10000 then raise exception 'INVALID_ODDS';end if;
 update public.settings set manual_odds=p_odds where id=p_campaign;
end $$;
revoke execute on function public.campaign_save_odds(integer,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.campaign_save_odds(integer,bigint,jsonb) to service_role;
