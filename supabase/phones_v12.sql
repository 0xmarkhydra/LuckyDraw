-- Accept all three formats at the database boundary; persist only E.164.
-- Lock in campaign -> play order to avoid concurrent draws during conversion.
lock table public.settings in access exclusive mode;
lock table public.plays in access exclusive mode;
create function public.normalize_vn_phone(p_phone text) returns text language sql immutable strict security invoker set search_path='' as $$
 select case when compact ~ '^(0|\+?84)[35789][0-9]{8}$' then '+84'||right(compact,9) else null end
 from (select regexp_replace(trim(p_phone),'[[:space:]().-]','','g') compact) t
$$;
revoke execute on function public.normalize_vn_phone(text) from public,anon,authenticated;
grant execute on function public.normalize_vn_phone(text) to service_role;
update public.plays set phone=public.normalize_vn_phone(phone) where phone is distinct from public.normalize_vn_phone(phone) and public.normalize_vn_phone(phone) is not null;
alter table public.plays add constraint plays_phone_e164 check(phone ~ '^\+84[35789][0-9]{8}$');
create or replace function public.campaign_draw(p_campaign integer,p_name text,p_phone text,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype; existing public.plays%rowtype; p public.prizes%rowtype; v public.vouchers%rowtype; odds jsonb; candidate record; total_tickets numeric; cutoff numeric; raw numeric; r numeric; cumulative numeric:=0; chosen uuid; reward text:='Chúc may mắn'; saved public.plays%rowtype; remaining integer; used_count bigint; won_count bigint; win_capped boolean; ts timestamptz; day_start timestamptz;
begin
 p_phone:=public.normalize_vn_phone(p_phone);
 if p_name is null or length(trim(p_name)) not between 2 and 100 or p_phone is null or p_phone !~ '^\+84[35789][0-9]{8}$' or p_request is null then raise exception 'INVALID_INPUT'; end if;
 select * into cfg from public.settings where id=p_campaign for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
 ts:=clock_timestamp();
 day_start:=date_trunc('day',ts at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
 select * into existing from public.plays where request_id=p_request;
 if found then
 if existing.campaign_id<>p_campaign or existing.phone<>p_phone or existing.name<>trim(p_name) then raise exception 'INVALID_REQUEST'; end if;
 select count(*) into used_count from public.plays where campaign_id=p_campaign and phone=p_phone and (cfg.play_period='campaign' or created_at>=day_start);
 remaining:=case when cfg.max_plays_per_phone is null then null else greatest(0,cfg.max_plays_per_phone-used_count)::integer end;
 return to_jsonb(existing)||jsonb_build_object('remaining_plays',remaining,'can_continue',public.campaign_is_open(cfg,ts) and (cfg.max_total_plays is null or (select count(*) from public.plays where campaign_id=p_campaign)<cfg.max_total_plays)); end if;
 if not public.campaign_is_open(cfg,ts) then raise exception 'GAME_CLOSED'; end if;
 select count(*) into used_count from public.plays where campaign_id=p_campaign and phone=p_phone and (cfg.play_period='campaign' or created_at>=day_start);
 if cfg.max_plays_per_phone is not null and used_count>=cfg.max_plays_per_phone then raise exception 'PLAY_LIMIT'; end if;
 if cfg.max_total_plays is not null and (select count(*) from public.plays where campaign_id=p_campaign)>=cfg.max_total_plays then raise exception 'CAMPAIGN_LIMIT'; end if;
 select count(*) into won_count from public.plays where campaign_id=p_campaign and phone=p_phone and prize_id is not null;
 win_capped:=cfg.max_wins_per_phone is not null and won_count>=cfg.max_wins_per_phone;
 select jsonb_agg(to_jsonb(w)||jsonb_build_object('probability',o.probability) order by w.prize_id nulls last),sum(w.tickets)
 into odds,total_tickets from public.campaign_weights(p_campaign) w join public.campaign_odds(p_campaign) o on w.prize_id is not distinct from o.prize_id;
 if win_capped then
 odds:=jsonb_build_array(jsonb_build_object('prize_id',null,'prize_name','Chúc may mắn','effective_quantity',null,'tickets',1,'probability',100,'reason','WIN_LIMIT')); total_tickets:=1;
 end if;
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
 select * into strict p from public.prizes where id=chosen and campaign_id=p_campaign for update;
 if not p.unlimited and p.quantity<=0 then raise exception 'STOCK_CONFLICT'; end if;
 if p.requires_code then
 select * into v from public.vouchers where campaign_id=p_campaign and prize_id=p.id and not used order by id limit 1 for update;
 if v.id is null then raise exception 'STOCK_CONFLICT'; end if;
 update public.vouchers set used=true where id=v.id;
 end if;
 if not p.unlimited then update public.prizes set quantity=quantity-1 where id=p.id; end if;
 reward:=p.name;
 end if;
 insert into public.plays(campaign_id,request_id,name,phone,prize_id,prize_name,voucher_id,voucher_code,odds_snapshot,created_at) values(p_campaign,p_request,trim(p_name),p_phone,chosen,reward,v.id,v.code,odds,ts) returning * into saved;
 remaining:=case when cfg.max_plays_per_phone is null then null else greatest(0,cfg.max_plays_per_phone-used_count-1)::integer end;
 return to_jsonb(saved)||jsonb_build_object('remaining_plays',remaining,'can_continue',public.campaign_is_open(cfg,ts) and (cfg.max_total_plays is null or (select count(*) from public.plays where campaign_id=p_campaign)<cfg.max_total_plays));
end $$;
