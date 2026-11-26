-- Automatic odds v2; existing prizes and plays are preserved.
alter table public.settings add column planned_plays integer not null default 5000 check (planned_plays between 1 and 1000000), add column no_win_weight integer not null default 80 check (no_win_weight between 1 and 1000000);
alter table public.prizes add column unlimited boolean not null default false, add column fallback_weight integer not null default 20 check (fallback_weight between 0 and 1000000), add constraint unlimited_no_unique_codes check (not unlimited or not requires_code), add constraint unlimited_no_stock check (not unlimited or quantity=0);
alter table public.plays add column odds_snapshot jsonb;
-- Returns exactly the odds used by draw, with a guaranteed no-win fallback.
create function public.draw_odds() returns table(prize_id uuid, prize_name text, effective_quantity bigint, probability numeric) language sql stable security invoker set search_path='' as $$
 with cfg as (select planned_plays,no_win_weight from public.settings where id=1),
 counts as (select count(*)::numeric n from public.plays),
 stock as (
 select p.id,p.name,p.unlimited,p.fallback_weight,
 case when p.unlimited then null::bigint when p.requires_code then least(p.quantity::bigint,coalesce(v.available,0)) else p.quantity::bigint end as effective
 from public.prizes p left join (select prize_id,count(*) available from public.vouchers where not used group by prize_id) v on v.prize_id=p.id
 ),
 totals as (select coalesce(sum(effective),0)::numeric finite_stock,coalesce(sum(fallback_weight) filter(where unlimited),0)::numeric unlimited_weight from stock),
 base as (select greatest(1::numeric,cfg.planned_plays-counts.n,totals.finite_stock) denominator,totals.finite_stock,totals.unlimited_weight+cfg.no_win_weight weight_sum from cfg cross join counts cross join totals),
 calculated as (select s.id,s.name,s.effective,case when s.unlimited then trunc((100::numeric-100*base.finite_stock/base.denominator)*s.fallback_weight/base.weight_sum,12) else trunc(100::numeric*s.effective/base.denominator,12) end chance from stock s cross join base)
 select id,name,effective,chance from calculated
 union all select null::uuid,'Chúc may mắn',null::bigint,100::numeric-coalesce(sum(chance),0) from calculated
$$;
create function public.save_prize_auto(p_id uuid,p_name text,p_quantity integer,p_unlimited boolean,p_requires_code boolean,p_fallback_weight integer) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; opened boolean;
begin
 select active into opened from public.settings where id=1 for update;
 if opened then raise exception 'PAUSE_CAMPAIGN'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 80 or p_quantity is null or p_quantity<0 or p_unlimited is null or p_requires_code is null or p_fallback_weight is null or p_fallback_weight not between 0 and 1000000 or (p_unlimited and (p_quantity<>0 or p_requires_code)) then raise exception 'INVALID_PRIZE'; end if;
 if p_id is not null and p_unlimited and exists(select 1 from public.vouchers where prize_id=p_id and not used) then raise exception 'EXISTING_VOUCHERS'; end if;
 if p_id is null then
 insert into public.prizes(name,quantity,probability,requires_code,unlimited,fallback_weight) values(trim(p_name),p_quantity,0,p_requires_code,p_unlimited,p_fallback_weight) returning id into result;
 else
 update public.prizes set name=trim(p_name),quantity=p_quantity,probability=0,requires_code=p_requires_code,unlimited=p_unlimited,fallback_weight=p_fallback_weight where id=p_id returning id into result;
 if result is null then raise exception 'PRIZE_NOT_FOUND'; end if;
 end if;
 return result;
end $$;
create function public.save_campaign(p_title text,p_description text,p_active boolean,p_planned_plays integer,p_no_win_weight integer) returns void language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype;
begin
 select * into cfg from public.settings where id=1 for update;
 if p_title is null or length(trim(p_title)) not between 1 and 120 or p_description is null or length(p_description)>500 or p_active is null or p_planned_plays is null or p_planned_plays not between 1 and 1000000 or p_no_win_weight is null or p_no_win_weight not between 1 and 1000000 then raise exception 'INVALID_SETTINGS'; end if;
 if cfg.active and p_active and (cfg.planned_plays<>p_planned_plays or cfg.no_win_weight<>p_no_win_weight) then raise exception 'PAUSE_CAMPAIGN'; end if;
 update public.settings set title=trim(p_title),description=p_description,active=p_active,planned_plays=p_planned_plays,no_win_weight=p_no_win_weight where id=1;
 if p_active and not exists(select 1 from public.draw_odds() o where o.prize_id is not null and o.probability>0) then raise exception 'NO_AVAILABLE_PRIZE'; end if;
end $$;
create function public.import_vouchers(p_prize uuid,p_codes text[]) returns integer language plpgsql security invoker set search_path='' as $$
declare opened boolean; inserted integer;
begin
 select active into opened from public.settings where id=1 for update;
 if opened then raise exception 'PAUSE_CAMPAIGN'; end if;
 if not exists(select 1 from public.prizes where id=p_prize and requires_code and not unlimited) then raise exception 'INVALID_VOUCHER_PRIZE'; end if;
 if p_codes is null or cardinality(p_codes) not between 1 and 5000 or exists(select 1 from unnest(p_codes) c where c is null or length(trim(c)) not between 1 and 200) then raise exception 'INVALID_CODES'; end if;
 insert into public.vouchers(prize_id,code) select p_prize,trim(c) from unnest(p_codes) c group by trim(c) on conflict(code) do nothing;
 get diagnostics inserted=row_count; return inserted;
end $$;
create or replace function public.draw(p_name text,p_phone text,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype; existing public.plays%rowtype; p public.prizes%rowtype; v public.vouchers%rowtype; odds jsonb; candidate record; r numeric; cumulative numeric:=0; chosen uuid; reward text:='Chúc may mắn'; saved public.plays%rowtype;
begin
 if p_name is null or length(trim(p_name)) not between 2 and 100 or p_phone is null or p_phone !~ '^0[35789][0-9]{8}$' or p_request is null then raise exception 'INVALID_INPUT'; end if;
 select * into cfg from public.settings where id=1 for update;
 select * into existing from public.plays where request_id=p_request;
 if found then
 if existing.phone<>p_phone or existing.name<>trim(p_name) then raise exception 'INVALID_REQUEST'; end if;
 return to_jsonb(existing); end if;
 if not cfg.active then raise exception 'GAME_CLOSED'; end if;
 if exists(select 1 from public.plays where phone=p_phone) then raise exception 'ALREADY_PLAYED'; end if;
 -- 48 random bits from a v4 UUID, excluding fixed version/variant bits.
 r:=('x'||substr(replace(gen_random_uuid()::text,'-',''),1,12))::bit(48)::bigint::numeric*100/281474976710656;
 select jsonb_agg(to_jsonb(o) order by o.prize_id nulls last) into odds from public.draw_odds() o;
 for candidate in select * from jsonb_to_recordset(odds) as o(prize_id uuid,prize_name text,probability numeric) order by prize_id nulls last loop
 cumulative:=cumulative+candidate.probability;
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
revoke execute on function public.draw_odds(),public.save_prize_auto(uuid,text,integer,boolean,boolean,integer),public.save_campaign(text,text,boolean,integer,integer),public.import_vouchers(uuid,text[]) from public,anon,authenticated;
grant execute on function public.draw_odds(),public.save_prize_auto(uuid,text,integer,boolean,boolean,integer),public.save_campaign(text,text,boolean,integer,integer),public.import_vouchers(uuid,text[]) to service_role;
-- Old clients may be running during deploy. Do not allow legacy prize edits while open.
create or replace function public.save_prize(p_id uuid,p_name text,p_quantity int,p_probability numeric,p_requires_code boolean) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 return public.save_prize_auto(p_id,p_name,p_quantity,false,p_requires_code,20);
end $$;
