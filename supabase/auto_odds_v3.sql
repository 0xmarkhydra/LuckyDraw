-- Exact ticket draw, without probability rounding influencing the award.
create function public.draw_weights() returns table(prize_id uuid,prize_name text,effective_quantity bigint,tickets numeric) language sql stable security invoker set search_path='' as $$
 with cfg as (select planned_plays,no_win_weight from public.settings where id=1),
 counts as (select count(*)::numeric n from public.plays),
 stock as (
 select p.id,p.name,p.unlimited,p.fallback_weight,
 case when p.unlimited then null::bigint when p.requires_code then least(p.quantity::bigint,coalesce(v.available,0)) else p.quantity::bigint end as effective
 from public.prizes p left join (select prize_id,count(*) available from public.vouchers where not used group by prize_id) v on v.prize_id=p.id
 ),
 totals as (select coalesce(sum(effective),0)::numeric finite_stock,coalesce(sum(fallback_weight) filter(where unlimited),0)::numeric unlimited_weight from stock),
 base as (select greatest(1::numeric,cfg.planned_plays-counts.n,totals.finite_stock) denominator,totals.finite_stock,totals.unlimited_weight+cfg.no_win_weight weight_sum,cfg.no_win_weight from cfg cross join counts cross join totals)
 select s.id,s.name,s.effective,case when s.unlimited then (b.denominator-b.finite_stock)*s.fallback_weight else s.effective*b.weight_sum end from stock s cross join base b
 union all select null::uuid,'Chúc may mắn',null::bigint,(denominator-finite_stock)*no_win_weight from base
$$;
create or replace function public.draw_odds() returns table(prize_id uuid,prize_name text,effective_quantity bigint,probability numeric) language sql stable security invoker set search_path='' as $$
 with weights as (select * from public.draw_weights()),
 rounded as (select w.*,trunc(100::numeric*w.tickets/sum(w.tickets) over(),12) chance,row_number() over(order by (w.tickets>0) desc,w.prize_id nulls first) recipient from weights w)
 select prize_id,prize_name,effective_quantity,chance+case when recipient=1 then 100::numeric-sum(chance) over() else 0 end from rounded
$$;
create or replace function public.draw(p_name text,p_phone text,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype; existing public.plays%rowtype; p public.prizes%rowtype; v public.vouchers%rowtype; odds jsonb; candidate record; total_tickets numeric; cutoff numeric; raw numeric; r numeric; cumulative numeric:=0; chosen uuid; reward text:='Chúc may mắn'; saved public.plays%rowtype;
begin
 if p_name is null or length(trim(p_name)) not between 2 and 100 or p_phone is null or p_phone !~ '^0[35789][0-9]{8}$' or p_request is null then raise exception 'INVALID_INPUT'; end if;
 select * into cfg from public.settings where id=1 for update;
 select * into existing from public.plays where request_id=p_request;
 if found then
 if existing.phone<>p_phone or existing.name<>trim(p_name) then raise exception 'INVALID_REQUEST'; end if;
 return to_jsonb(existing); end if;
 if not cfg.active then raise exception 'GAME_CLOSED'; end if;
 if exists(select 1 from public.plays where phone=p_phone) then raise exception 'ALREADY_PLAYED'; end if;
 select jsonb_agg(to_jsonb(w)||jsonb_build_object('probability',o.probability) order by w.prize_id nulls last),sum(w.tickets)
 into odds,total_tickets from public.draw_weights() w join public.draw_odds() o on w.prize_id is not distinct from o.prize_id;
 if total_tickets is null or total_tickets<=0 or total_tickets>79228162514264337593543950336::numeric then raise exception 'INVALID_ODDS'; end if;
 cutoff:=79228162514264337593543950336::numeric-mod(79228162514264337593543950336::numeric,total_tickets);
 -- 96 independent random bits; rejection sampling removes modulo bias.
 loop
 raw:=('x'||substr(replace(gen_random_uuid()::text,'-',''),1,12))::bit(48)::bigint::numeric*281474976710656::numeric+('x'||substr(replace(gen_random_uuid()::text,'-',''),1,12))::bit(48)::bigint::numeric;
 exit when raw<cutoff;
 end loop;
 r:=mod(raw,total_tickets);
 for candidate in select * from jsonb_to_recordset(odds) as o(prize_id uuid,prize_name text,tickets numeric) order by prize_id nulls last loop
 cumulative:=cumulative+candidate.tickets;
 if r<cumulative then chosen:=candidate.prize_id; exit; end if;
 end loop;
 if chosen is not null then
 select * into strict p from public.prizes where id=chosen for update;
 if not p.unlimited and p.quantity<=0 then raise exception 'STOCK_CONFLICT'; end if;
 if p.requires_code then
 select * into v from public.vouchers where prize_id=p.id and not used order by id limit 1 for update;
 if v.id is null then raise exception 'STOCK_CONFLICT'; end if;
 update public.vouchers set used=true where id=v.id;
 end if;
 if not p.unlimited then update public.prizes set quantity=quantity-1 where id=p.id; end if;
 reward:=p.name;
 end if;
 insert into public.plays(request_id,name,phone,prize_id,prize_name,voucher_id,voucher_code,odds_snapshot) values(p_request,trim(p_name),p_phone,chosen,reward,v.id,v.code,odds) returning * into saved;
 return to_jsonb(saved);
end $$;
alter table public.prizes add column revision bigint not null default 0;
alter table public.settings add column revision bigint not null default 0;
create function public.bump_revision() returns trigger language plpgsql security invoker set search_path='' as $$ begin new.revision:=old.revision+1; return new; end $$;
create trigger prize_revision before update on public.prizes for each row execute function public.bump_revision();
create trigger settings_revision before update on public.settings for each row execute function public.bump_revision();
create function public.save_prize_versioned(p_id uuid,p_name text,p_quantity integer,p_unlimited boolean,p_requires_code boolean,p_fallback_weight integer,p_expected_revision bigint) returns uuid language plpgsql security invoker set search_path='' as $$
declare current_revision bigint;
begin
 perform 1 from public.settings where id=1 for update;
 if p_id is not null then
 select revision into current_revision from public.prizes where id=p_id for update;
 if not found then raise exception 'PRIZE_NOT_FOUND'; end if;
 if p_expected_revision is distinct from current_revision then raise exception 'STALE_CONFIG'; end if;
 end if;
 return public.save_prize_auto(p_id,p_name,p_quantity,p_unlimited,p_requires_code,p_fallback_weight);
end $$;
create function public.save_campaign_versioned(p_title text,p_description text,p_active boolean,p_planned_plays integer,p_no_win_weight integer,p_expected_revision bigint) returns void language plpgsql security invoker set search_path='' as $$
declare current_revision bigint;
begin
 select revision into current_revision from public.settings where id=1 for update;
 if p_expected_revision is distinct from current_revision then raise exception 'STALE_CONFIG'; end if;
 perform public.save_campaign(p_title,p_description,p_active,p_planned_plays,p_no_win_weight);
end $$;
revoke execute on function public.draw_weights(),public.bump_revision(),public.save_prize_versioned(uuid,text,integer,boolean,boolean,integer,bigint),public.save_campaign_versioned(text,text,boolean,integer,integer,bigint) from public,anon,authenticated;
grant execute on function public.draw_weights(),public.bump_revision(),public.save_prize_versioned(uuid,text,integer,boolean,boolean,integer,bigint),public.save_campaign_versioned(text,text,boolean,integer,integer,bigint) to service_role;
