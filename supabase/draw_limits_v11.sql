-- Short-lived anti-abuse buckets. No raw IP, device identifier or phone number stored.
create table public.draw_limits (
 bucket text primary key,
 attempts integer not null default 0,
 phone_hashes text[] not null default '{}',
 expires_at timestamptz not null
);
create index draw_limits_expiry on public.draw_limits(expires_at);
alter table public.draw_limits enable row level security;
revoke all on public.draw_limits from public,anon,authenticated;
grant select,insert,update,delete on public.draw_limits to service_role;

create function public.consume_draw_quota(p_campaign integer,p_ip_hash text,p_phone_hash text,p_device_hash text default null) returns boolean language plpgsql security invoker set search_path='' as $$
declare ts timestamptz:=clock_timestamp(); ten bigint:=floor(extract(epoch from ts)/600); day bigint:=floor(extract(epoch from ts)/86400); expiry10 timestamptz:=to_timestamp((ten+1)*600); expiryday timestamptz:=to_timestamp((day+1)*86400); item record; current_row public.draw_limits%rowtype;
begin
 if p_campaign is null or p_campaign<1 or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' or p_phone_hash is null or p_phone_hash !~ '^[a-f0-9]{64}$' or (p_device_hash is not null and p_device_hash !~ '^[a-f0-9]{64}$') then return false;end if;
 -- The same lock order is used by every request. Count attempts even when later checks reject.
 for item in select * from (values
  (1,'ip-global:'||ten||':'||p_ip_hash,180,0,expiry10),
  (2,'ip-campaign:'||p_campaign||':'||ten||':'||p_ip_hash,60,0,expiry10),
  (3,'ip-phones:'||p_campaign||':'||day||':'||p_ip_hash,0,30,expiryday),
  (4,case when p_device_hash is not null then 'device-phones:'||p_campaign||':'||day||':'||p_device_hash end,0,3,expiryday),
  (5,'phone:'||p_campaign||':'||ten||':'||p_phone_hash,30,0,expiry10)
 ) as limits(ord,key,attempt_limit,distinct_limit,expiry) where key is not null order by ord loop
  insert into public.draw_limits(bucket,expires_at) values(item.key,item.expiry) on conflict do nothing;
  select * into current_row from public.draw_limits where bucket=item.key for update;
  if item.attempt_limit>0 and current_row.attempts>=item.attempt_limit then return false;end if;
  if item.distinct_limit>0 and not(p_phone_hash=any(current_row.phone_hashes)) and cardinality(current_row.phone_hashes)>=item.distinct_limit then return false;end if;
  update public.draw_limits set attempts=least(attempts,1000000)+1,phone_hashes=case when item.distinct_limit>0 and not(p_phone_hash=any(phone_hashes)) then array_append(phone_hashes,p_phone_hash) else phone_hashes end where bucket=item.key;
 end loop;
 -- Bounded opportunistic cleanup. Skip locked rows so cleanup does not reverse lock order.
 if random()<0.02 then
  delete from public.draw_limits where bucket in (select bucket from public.draw_limits where expires_at<ts order by expires_at limit 500 for update skip locked);
 end if;
 return true;
end $$;
revoke execute on function public.consume_draw_quota(integer,text,text,text) from public,anon,authenticated;
grant execute on function public.consume_draw_quota(integer,text,text,text) to service_role;
