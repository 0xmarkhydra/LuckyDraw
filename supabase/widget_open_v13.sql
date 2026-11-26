-- Empty allowlist permits supported websites; preserve existing restricted configurations.
create or replace function public.save_widget(p_campaign integer,p_revision bigint,p_enabled boolean,p_origins text[]) returns void language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype;
begin
 select * into cfg from public.settings where id=p_campaign for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
 if cfg.revision is distinct from p_revision then raise exception 'STALE_CONFIG'; end if;
 if p_enabled is null or p_origins is null or cardinality(p_origins)>25 or exists(select 1 from unnest(p_origins) o where o is null or length(o)>300 or o !~ '^(https://[a-z0-9][a-z0-9.-]*(:[0-9]{1,5})?|http://(localhost|127[.]0[.]0[.]1)(:[0-9]{1,5})?)$') then raise exception 'INVALID_ORIGINS'; end if;
 update public.settings set widget_enabled=p_enabled,widget_origins=p_origins where id=p_campaign;
end $$;
create or replace function public.widget_event(p_campaign integer,p_instance uuid,p_origin text,p_event text) returns void language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype;
begin
 select * into cfg from public.settings where id=p_campaign;
 if not found or not cfg.widget_enabled or not (p_origin is not null and length(p_origin)<=300 and p_origin ~ '^(https://[a-z0-9][a-z0-9.-]*(:[0-9]{1,5})?|http://(localhost|127[.]0[.]0[.]1)(:[0-9]{1,5})?)$' and (cardinality(cfg.widget_origins)=0 or p_origin=any(cfg.widget_origins))) or not public.campaign_is_open(cfg,clock_timestamp()) then return; end if;
 if p_event not in ('impression','open') or p_instance is null then raise exception 'INVALID_EVENT'; end if;
 if p_event='open' and not exists(select 1 from public.widget_events where campaign_id=p_campaign and instance_id=p_instance and origin=p_origin and event_type='impression') then return; end if;
 insert into public.widget_events(campaign_id,instance_id,event_type,origin) values(p_campaign,p_instance,p_event,p_origin) on conflict do nothing;
end $$;
create or replace function public.campaign_draw_attributed(p_campaign integer,p_name text,p_phone text,p_request uuid,p_origin text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype; replay boolean; result jsonb;
begin
 select * into cfg from public.settings where id=p_campaign for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND';end if;
 select exists(select 1 from public.plays where request_id=p_request) into replay;
 if p_origin is not null and not replay and (not cfg.widget_enabled or not (p_origin is not null and length(p_origin)<=300 and p_origin ~ '^(https://[a-z0-9][a-z0-9.-]*(:[0-9]{1,5})?|http://(localhost|127[.]0[.]0[.]1)(:[0-9]{1,5})?)$' and (cardinality(cfg.widget_origins)=0 or p_origin=any(cfg.widget_origins)))) then raise exception 'WIDGET_DISABLED';end if;
 result:=public.campaign_draw(p_campaign,p_name,p_phone,p_request);
 if not replay and p_origin is not null then
 update public.plays set source_channel='widget',source_origin=p_origin where campaign_id=p_campaign and request_id=p_request;
 end if;
 return result;
end $$;
