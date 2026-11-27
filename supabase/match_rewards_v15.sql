-- Settlement and reward delivery: no public voucher access.
alter table public.settings add column match_rewards jsonb not null default '[]'::jsonb check(jsonb_typeof(match_rewards)='array');
alter table public.settings add column match_finalized_at timestamptz;
create table public.match_awards(
 campaign_id integer not null references public.settings(id) on delete restrict,
 session_id uuid not null references public.match_sessions(id) on delete restrict,
 rank integer not null check(rank>0),
 reward text not null,
 code text,
 delivered_at timestamptz,
 primary key(campaign_id,session_id),
 unique(campaign_id,rank),
 unique(campaign_id,code)
);
alter table public.match_awards enable row level security;
revoke all on public.match_awards from public,anon,authenticated;
grant select,insert,update on public.match_awards to service_role;
create function public.match_guard_finalized() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.game_type='match3' and old.match_finalized_at is not null and
 (new.active or new.match_finalized_at is distinct from old.match_finalized_at or new.game_type is distinct from old.game_type or new.match_rewards is distinct from old.match_rewards or new.match_seconds is distinct from old.match_seconds or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at) then
 raise exception 'MATCH_FINALIZED';
 end if;
 return new;
end $$;
create trigger match_guard_finalized before update on public.settings for each row execute function public.match_guard_finalized();

create function public.match_save_rewards(p_campaign integer,p_revision bigint,p_rewards jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype; tier jsonb; lo integer; hi integer; used_ranks integer[]:='{}'; used_codes text[]:='{}'; n integer; v text;
begin
 select * into cfg from public.settings where id=p_campaign and game_type='match3' for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND';end if;
 if cfg.match_finalized_at is not null then raise exception 'MATCH_FINALIZED';end if;
 if cfg.active then raise exception 'PAUSE_CAMPAIGN';end if;
 if cfg.revision is distinct from p_revision then raise exception 'STALE_CONFIG';end if;
 if p_rewards is null or jsonb_typeof(p_rewards)<>'array' or jsonb_array_length(p_rewards)>50 then raise exception 'INVALID_RANK_REWARDS';end if;
 for tier in select value from jsonb_array_elements(p_rewards) loop
  if jsonb_typeof(tier)<>'object' or coalesce(tier->>'from','')!~'^[0-9]{1,4}$' or coalesce(tier->>'to','')!~'^[0-9]{1,4}$' or jsonb_typeof(tier->'name') is distinct from 'string' or length(trim(tier->>'name')) not between 1 and 120 or jsonb_typeof(tier->'codes') is distinct from 'array' then raise exception 'INVALID_RANK_REWARDS';end if;
  lo:=(tier->>'from')::integer;hi:=(tier->>'to')::integer;
  if lo<1 or hi<lo or hi>1000 or jsonb_array_length(tier->'codes') not in (0,hi-lo+1) then raise exception 'INVALID_RANK_REWARDS';end if;
  for n in lo..hi loop
   if n=any(used_ranks) then raise exception 'OVERLAP_RANK';end if;
   used_ranks:=array_append(used_ranks,n);
  end loop;
  for v in select value#>>'{}' from jsonb_array_elements(tier->'codes') loop
   if v is null or length(v) not between 1 and 200 or trim(v)<>v or v=any(used_codes) then raise exception 'INVALID_RANK_CODES';end if;
   used_codes:=array_append(used_codes,v);
  end loop;
  if exists(select 1 from jsonb_array_elements(tier->'codes') as x(value) where jsonb_typeof(value)<>'string') then raise exception 'INVALID_RANK_CODES';end if;
 end loop;
 update public.settings set match_rewards=p_rewards where id=p_campaign;
end $$;

create function public.match_finalize(p_campaign integer,p_revision bigint) returns integer language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype; ts timestamptz; n integer;
begin
 select * into cfg from public.settings where id=p_campaign and game_type='match3' for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND';end if;
 if cfg.match_finalized_at is not null then return (select count(*) from public.match_awards where campaign_id=p_campaign);end if;
 if cfg.revision is distinct from p_revision then raise exception 'STALE_CONFIG';end if;
 if cfg.active and (cfg.ends_at is null or cfg.ends_at>clock_timestamp()) then raise exception 'PAUSE_CAMPAIGN';end if;
 -- Synchronize with any move committed just before the timer expired.
 perform id from public.match_sessions where campaign_id=p_campaign order by id for update;
 ts:=clock_timestamp();
 if exists(select 1 from public.match_sessions where campaign_id=p_campaign and expires_at>ts) then raise exception 'MATCH_IN_PROGRESS';end if;
 insert into public.match_awards(campaign_id,session_id,rank,reward,code)
 select p_campaign,r.id,r.rank::integer,trim(tier->>'name'),tier->'codes'->>(r.rank::integer-(tier->>'from')::integer)
 from (select id,score,row_number() over(order by score desc,score_at,id) rank from public.match_sessions where campaign_id=p_campaign) r
 cross join jsonb_array_elements(cfg.match_rewards) tier
 where r.score>0 and r.rank between (tier->>'from')::integer and (tier->>'to')::integer;
 get diagnostics n=row_count;
 update public.settings set active=false,match_finalized_at=ts where id=p_campaign;
 return n;
end $$;
create function public.match_deliver(p_campaign integer,p_rank integer) returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.match_awards set delivered_at=coalesce(delivered_at,clock_timestamp()) where campaign_id=p_campaign and rank=p_rank;
 if not found then raise exception 'AWARD_NOT_FOUND';end if;
end $$;
create function public.match_report(p_campaign integer,p_cutoff timestamptz,p_limit integer,p_offset integer) returns table(rank bigint,phone text,score integer,score_at timestamptz,started_at timestamptz,origin text,reward text,code text,delivered_at timestamptz) language sql stable security invoker set search_path='' as $$
 select row_number() over(order by m.score desc,m.score_at,m.id),m.phone,m.score,m.score_at,m.started_at,m.origin,a.reward,a.code,a.delivered_at
 from public.match_sessions m left join public.match_awards a on a.campaign_id=m.campaign_id and a.session_id=m.id
 where m.campaign_id=p_campaign and m.expires_at<=least(p_cutoff,now()) order by m.score desc,m.score_at,m.id
 limit least(greatest(p_limit,1),500) offset greatest(p_offset,0)
$$;
revoke execute on function public.match_guard_finalized(),public.match_save_rewards(integer,bigint,jsonb),public.match_finalize(integer,bigint),public.match_deliver(integer,integer),public.match_report(integer,timestamptz,integer,integer) from public,anon,authenticated;
grant execute on function public.match_save_rewards(integer,bigint,jsonb),public.match_finalize(integer,bigint),public.match_deliver(integer,integer),public.match_report(integer,timestamptz,integer,integer) to service_role;
