-- Each account owns its campaigns; preserve the existing administrator's campaigns.
alter table public.settings add column owner_id uuid references auth.users(id) on delete restrict;
do $$ declare legacy_owner uuid; begin
 select id into strict legacy_owner from auth.users where lower(email)='admin@luckydraw.example' and raw_app_meta_data->>'luckydraw_role'='admin' and email_confirmed_at is not null;
 update public.settings set owner_id=legacy_owner where owner_id is null;
end $$;
alter table public.settings alter column owner_id set not null;
create index settings_owner_id_idx on public.settings(owner_id,id);
create function public.campaign_create_owned(p_owner uuid,p_slug text,p_title text) returns integer language plpgsql security invoker set search_path='' as $$
declare result integer;
begin
 if p_owner is null then raise exception 'ACCOUNT_NOT_VERIFIED'; end if;
 if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$' or p_title is null or length(trim(p_title)) not between 1 and 120 then raise exception 'INVALID_SETTINGS';end if;
 insert into public.settings(owner_id,slug,title,active) values(p_owner,p_slug,trim(p_title),false) returning id into result;
 return result;
end $$;
-- Compatibility for the former admin-only release during deployment.
create or replace function public.campaign_create(p_slug text,p_title text) returns integer language plpgsql security invoker set search_path='' as $$
declare legacy_owner uuid;
begin
 select owner_id into strict legacy_owner from public.settings where id=1;
 return public.campaign_create_owned(legacy_owner,p_slug,p_title);
end $$;
-- All sensitive access remains server-only. Ownership is determined from the verified token, never from client input.
revoke execute on function public.campaign_create_owned(uuid,text,text) from public,anon,authenticated;
grant execute on function public.campaign_create_owned(uuid,text,text) to service_role;