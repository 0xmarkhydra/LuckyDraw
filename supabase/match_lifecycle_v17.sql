create or replace function public.match_guard_finalized() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 -- An empty settlement can be returned to draft, never directly reopened.
 if old.game_type='match3' and old.match_finalized_at is not null and new.match_finalized_at is null and not new.active and new.game_type=old.game_type and new.match_rewards=old.match_rewards and new.match_seconds=old.match_seconds and new.starts_at is not distinct from old.starts_at and new.ends_at is not distinct from old.ends_at and not exists(select 1 from public.match_sessions where campaign_id=old.id) and not exists(select 1 from public.match_awards where campaign_id=old.id) then return new; end if;
 if old.game_type='match3' and old.match_finalized_at is not null and
 (new.active or new.match_finalized_at is distinct from old.match_finalized_at or new.game_type is distinct from old.game_type or new.match_rewards is distinct from old.match_rewards or new.match_seconds is distinct from old.match_seconds or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at) then
 raise exception 'MATCH_FINALIZED';
 end if;
 return new;
end $$;
create or replace function public.match_finalize(p_campaign integer,p_revision bigint) returns integer language plpgsql security invoker set search_path='' as $$
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
 if (cfg.ends_at is null or cfg.ends_at>ts) and not exists(select 1 from public.match_sessions where campaign_id=p_campaign) then raise exception 'MATCH_EMPTY';end if;
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
create function public.match_restore_draft(p_campaign integer,p_revision bigint) returns void language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype;
begin
 select * into cfg from public.settings where id=p_campaign and game_type='match3' for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND';end if;
 if cfg.revision is distinct from p_revision then raise exception 'STALE_CONFIG';end if;
 if cfg.match_finalized_at is null then return;end if;
 if exists(select 1 from public.match_sessions where campaign_id=p_campaign) or exists(select 1 from public.match_awards where campaign_id=p_campaign) then raise exception 'MATCH_FINALIZED';end if;
 update public.settings set active=false,match_finalized_at=null where id=p_campaign;
end $$;
revoke execute on function public.match_restore_draft(integer,bigint) from public,anon,authenticated;
grant execute on function public.match_restore_draft(integer,bigint) to service_role;
