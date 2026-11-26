-- Guard the public self-service registration endpoint. No email addresses are stored here.
create table public.signup_limits (
 bucket text primary key,
 attempts integer not null default 0,
 expires_at timestamptz not null
);
alter table public.signup_limits enable row level security;
revoke all on public.signup_limits from public,anon,authenticated;
grant select,insert,update,delete on public.signup_limits to service_role;
create function public.consume_signup_quota(p_email_hash text,p_ip_hash text) returns boolean language plpgsql security invoker set search_path='' as $$
declare slot text:=floor(extract(epoch from clock_timestamp())/3600)::bigint::text; expiry timestamptz:=date_trunc('hour',clock_timestamp())+interval '1 hour'; hits integer; key text;
begin
 if p_email_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$' then return false;end if;
 -- The global row serializes all quota checks, and caps the number of rows created per hour.
 insert into public.signup_limits(bucket,expires_at) values('global:'||slot,expiry) on conflict do nothing;
 select attempts into hits from public.signup_limits where bucket='global:'||slot for update;
 if hits>=100 then return false;end if;
 for key in select unnest(array['ip:'||slot||':'||p_ip_hash,'email:'||slot||':'||p_email_hash]) loop
 insert into public.signup_limits(bucket,expires_at) values(key,expiry) on conflict do nothing;
 select attempts into hits from public.signup_limits where bucket=key;
 if hits >= (case when key like 'email:%' then 3 else 10 end) then return false;end if;
 end loop;
 update public.signup_limits set attempts=attempts+1 where bucket in ('global:'||slot,'ip:'||slot||':'||p_ip_hash,'email:'||slot||':'||p_email_hash);
 delete from public.signup_limits where expires_at<clock_timestamp()-interval '1 hour';
 return true;
end $$;
revoke execute on function public.consume_signup_quota(text,text) from public,anon,authenticated;
grant execute on function public.consume_signup_quota(text,text) to service_role;