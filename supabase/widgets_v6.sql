-- Embed configuration, event attribution and source isolation.
alter table public.settings add column widget_enabled boolean not null default false, add column widget_origins text[] not null default '{}'::text[] check(cardinality(widget_origins)<=25);
alter table public.plays add column source_channel text not null default 'landing' check(source_channel in ('landing','widget')), add column source_origin text;
alter table public.plays add constraint play_source_consistency check((source_channel='landing' and source_origin is null) or (source_channel='widget' and source_origin is not null));
create table public.widget_events (
 campaign_id integer not null references public.settings(id),
 instance_id uuid not null,
 event_type text not null check(event_type in ('impression','open')),
 origin text not null,
 created_at timestamptz not null default now(),
 primary key(campaign_id,instance_id,event_type)
);
alter table public.widget_events enable row level security;
revoke all on public.widget_events from public,anon,authenticated;
grant select,insert on public.widget_events to service_role;
create index widget_events_campaign_origin on public.widget_events(campaign_id,origin);
create function public.save_widget(p_campaign integer,p_revision bigint,p_enabled boolean,p_origins text[]) returns void language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype;
begin
 select * into cfg from public.settings where id=p_campaign for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
 if cfg.revision is distinct from p_revision then raise exception 'STALE_CONFIG'; end if;
 if p_enabled is null or p_origins is null or cardinality(p_origins)>25 or exists(select 1 from unnest(p_origins) o where o is null or length(o)>300 or o !~ '^(https://[a-z0-9][a-z0-9.-]*(:[0-9]{1,5})?|http://(localhost|127[.]0[.]0[.]1)(:[0-9]{1,5})?)$') then raise exception 'INVALID_ORIGINS'; end if;
 if p_enabled and cardinality(p_origins)=0 then raise exception 'INVALID_ORIGINS'; end if;
 update public.settings set widget_enabled=p_enabled,widget_origins=p_origins where id=p_campaign;
end $$;
create function public.widget_event(p_campaign integer,p_instance uuid,p_origin text,p_event text) returns void language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype;
begin
 select * into cfg from public.settings where id=p_campaign;
 if not found or not cfg.widget_enabled or not (p_origin=any(cfg.widget_origins)) or not public.campaign_is_open(cfg,clock_timestamp()) then return; end if;
 if p_event not in ('impression','open') or p_instance is null then raise exception 'INVALID_EVENT'; end if;
 if p_event='open' and not exists(select 1 from public.widget_events where campaign_id=p_campaign and instance_id=p_instance and origin=p_origin and event_type='impression') then return; end if;
 insert into public.widget_events(campaign_id,instance_id,event_type,origin) values(p_campaign,p_instance,p_event,p_origin) on conflict do nothing;
end $$;
create function public.widget_stats(p_campaign integer) returns jsonb language sql stable security invoker set search_path='' as $$
 with e as (select origin,count(*) filter(where event_type='impression') impressions,count(*) filter(where event_type='open') opens from public.widget_events where campaign_id=p_campaign group by origin),
 p as (select source_origin origin,count(*) plays,count(*) filter(where prize_id is not null) wins from public.plays where campaign_id=p_campaign and source_channel='widget' group by source_origin),
 sources as (select coalesce(e.origin,p.origin) origin,coalesce(e.impressions,0) impressions,coalesce(e.opens,0) opens,coalesce(p.plays,0) plays,coalesce(p.wins,0) wins from e full join p using(origin))
 select jsonb_build_object('impressions',coalesce(sum(impressions),0),'opens',coalesce(sum(opens),0),'plays',coalesce(sum(plays),0),'wins',coalesce(sum(wins),0),'sources',coalesce(jsonb_agg(to_jsonb(sources) order by origin),'[]'::jsonb)) from sources
$$;
create function public.campaign_draw_attributed(p_campaign integer,p_name text,p_phone text,p_request uuid,p_origin text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype; replay boolean; result jsonb;
begin
 select * into cfg from public.settings where id=p_campaign for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND';end if;
 select exists(select 1 from public.plays where request_id=p_request) into replay;
 if p_origin is not null and not replay and (not cfg.widget_enabled or not (p_origin=any(cfg.widget_origins))) then raise exception 'WIDGET_DISABLED';end if;
 result:=public.campaign_draw(p_campaign,p_name,p_phone,p_request);
 if not replay and p_origin is not null then
 update public.plays set source_channel='widget',source_origin=p_origin where campaign_id=p_campaign and request_id=p_request;
 end if;
 return result;
end $$;
revoke execute on function public.save_widget(integer,bigint,boolean,text[]),public.widget_event(integer,uuid,text,text),public.widget_stats(integer),public.campaign_draw_attributed(integer,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.save_widget(integer,bigint,boolean,text[]),public.widget_event(integer,uuid,text,text),public.widget_stats(integer),public.campaign_draw_attributed(integer,text,text,uuid,text) to service_role;
