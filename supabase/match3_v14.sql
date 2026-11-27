-- Multi-game extension; existing campaigns remain lucky wheel.
alter table public.settings add column game_type text not null default 'wheel' check(game_type in ('wheel','match3'));
alter table public.settings add column match_seconds integer not null default 90 check(match_seconds in (60,90,120));
create table public.match_sessions(
 id uuid primary key,
 campaign_id integer not null references public.settings(id) on delete restrict,
 phone text not null check(phone ~ '^\+84[35789][0-9]{8}$'),
 board jsonb not null check(jsonb_typeof(board)='array' and jsonb_array_length(board)=64),
 rng bigint not null,
 score integer not null default 0 check(score>=0),
 seq integer not null default 0 check(seq>=0),
 started_at timestamptz not null,
 expires_at timestamptz not null,
 score_at timestamptz not null,
 origin text,
 unique(campaign_id,phone)
);
create index match_rank_idx on public.match_sessions(campaign_id,score desc,score_at,id);
alter table public.match_sessions enable row level security;
revoke all on public.match_sessions from public,anon,authenticated;
grant select,insert,update on public.match_sessions to service_role;
create function public.match_create(p_owner uuid,p_slug text,p_title text) returns integer language plpgsql security invoker set search_path='' as $$
declare cid integer;
begin
 cid:=public.campaign_create_owned(p_owner,p_slug,p_title);
 update public.settings set game_type='match3',max_plays_per_phone=1,play_period='campaign' where id=cid;
 return cid;
end $$;
create function public.match_save(p_campaign integer,p_revision bigint,p_title text,p_description text,p_seconds integer,p_active boolean,p_starts timestamptz,p_ends timestamptz) returns void language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype;
begin
 select * into cfg from public.settings where id=p_campaign and game_type='match3' for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND';end if;
 if cfg.revision is distinct from p_revision then raise exception 'STALE_CONFIG';end if;
 if p_title is null or length(trim(p_title)) not between 1 and 120 or length(coalesce(p_description,''))>2000 or p_seconds is null or p_seconds not in (60,90,120) or p_active is null or (p_ends is not null and p_starts is not null and p_ends<=p_starts) or (p_active and p_ends is not null and p_ends<=clock_timestamp()) then raise exception 'INVALID_SETTINGS';end if;
 if cfg.active and (p_seconds<>cfg.match_seconds or p_starts is distinct from cfg.starts_at or p_ends is distinct from cfg.ends_at) then raise exception 'PAUSE_CAMPAIGN';end if;
 if p_seconds<>cfg.match_seconds and exists(select 1 from public.match_sessions where campaign_id=p_campaign) then raise exception 'MATCH_STARTED';end if;
 update public.settings set title=trim(p_title),description=coalesce(p_description,''),match_seconds=p_seconds,active=p_active,starts_at=p_starts,ends_at=p_ends where id=p_campaign;
end $$;
create function public.match_start(p_campaign integer,p_id uuid,p_phone text,p_board jsonb,p_rng bigint,p_origin text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype; s public.match_sessions%rowtype; ts timestamptz;
begin
 select * into cfg from public.settings where id=p_campaign and game_type='match3' for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND';end if;
 ts:=clock_timestamp();
 select * into s from public.match_sessions where id=p_id;
 if found then
  if s.campaign_id<>p_campaign or s.phone<>p_phone then raise exception 'INVALID_REQUEST';end if;
  return to_jsonb(s);
 end if;
 if not public.campaign_is_open(cfg,ts) or (cfg.ends_at is not null and cfg.ends_at<ts+make_interval(secs=>cfg.match_seconds)) then raise exception 'GAME_CLOSED';end if;
 if p_origin is not null and (not cfg.widget_enabled or (cardinality(cfg.widget_origins)>0 and not(p_origin=any(cfg.widget_origins)))) then raise exception 'WIDGET_DISABLED';end if;
 if exists(select 1 from public.match_sessions where campaign_id=p_campaign and phone=p_phone) then raise exception 'PLAY_LIMIT';end if;
 if cfg.max_total_plays is not null and (select count(*) from public.match_sessions where campaign_id=p_campaign)>=cfg.max_total_plays then raise exception 'CAMPAIGN_LIMIT';end if;
 insert into public.match_sessions(id,campaign_id,phone,board,rng,started_at,expires_at,score_at,origin)
 values(p_id,p_campaign,p_phone,p_board,p_rng,ts,ts+make_interval(secs=>cfg.match_seconds),ts,p_origin) returning * into s;
 return to_jsonb(s);
end $$;
create function public.match_move(p_id uuid,p_campaign integer,p_seq integer,p_board jsonb,p_rng bigint,p_delta integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.match_sessions%rowtype; ts timestamptz;
begin
 select * into s from public.match_sessions where id=p_id and campaign_id=p_campaign for update;
 if not found then raise exception 'INVALID_REQUEST';end if;
 ts:=clock_timestamp();
 if s.expires_at<=ts then raise exception 'MATCH_ENDED';end if;
 if s.seq<>p_seq then raise exception 'STALE_MOVE';end if;
 if s.score_at+interval '200 milliseconds'>ts then raise exception 'MOVE_RATE';end if;
 if p_delta is null or p_delta<=0 or p_delta>100000 or s.seq>=600 then raise exception 'INVALID_MOVE';end if;
 update public.match_sessions set board=p_board,rng=p_rng,score=score+p_delta,seq=seq+1,score_at=ts where id=p_id returning * into s;
 return to_jsonb(s);
end $$;
create function public.match_rank(p_campaign integer,p_limit integer,p_offset integer default 0) returns table(rank bigint,phone text,score integer,score_at timestamptz) language sql stable security invoker set search_path='' as $$
 select row_number() over(order by m.score desc,m.score_at,m.id),m.phone,m.score,m.score_at from public.match_sessions m where m.campaign_id=p_campaign and m.expires_at<=now() order by m.score desc,m.score_at,m.id limit least(greatest(p_limit,1),100) offset greatest(p_offset,0)
$$;
revoke execute on function public.match_create(uuid,text,text),public.match_save(integer,bigint,text,text,integer,boolean,timestamptz,timestamptz),public.match_start(integer,uuid,text,jsonb,bigint,text),public.match_move(uuid,integer,integer,jsonb,bigint,integer),public.match_rank(integer,integer,integer) from public,anon,authenticated;
grant execute on function public.match_create(uuid,text,text),public.match_save(integer,bigint,text,text,integer,boolean,timestamptz,timestamptz),public.match_start(integer,uuid,text,jsonb,bigint,text),public.match_move(uuid,integer,integer,jsonb,bigint,integer),public.match_rank(integer,integer,integer) to service_role;
create function public.match_position(p_campaign integer,p_id uuid) returns bigint language sql stable security invoker set search_path='' as $$
 select 1+(select count(*) from public.match_sessions m where m.campaign_id=s.campaign_id and m.expires_at<=now() and (m.score>s.score or (m.score=s.score and (m.score_at,m.id)<(s.score_at,s.id)))) from public.match_sessions s where s.id=p_id and s.campaign_id=p_campaign and s.expires_at<=now()
$$;
revoke execute on function public.match_position(integer,uuid) from public,anon,authenticated;
grant execute on function public.match_position(integer,uuid) to service_role;
