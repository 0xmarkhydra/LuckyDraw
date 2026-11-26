begin;
create table public.settings (id int primary key check(id=1), title text not null default 'Vòng quay may mắn', description text not null default 'Thử vận may và nhận quà!', active boolean not null default false);
insert into public.settings(id) values(1);
create table public.prizes (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 80), quantity int not null check(quantity>=0), probability numeric(5,2) not null check(probability between 0 and 100), requires_code boolean not null default true);
create table public.vouchers (id uuid primary key default gen_random_uuid(), prize_id uuid not null references public.prizes(id), code text not null unique check(length(code) between 1 and 200), used boolean not null default false);
create index vouchers_available on public.vouchers(prize_id,id) where not used;
create table public.plays (id bigint generated always as identity primary key, request_id uuid not null unique, name text not null, phone text not null unique, prize_id uuid references public.prizes(id), prize_name text not null, voucher_id uuid unique references public.vouchers(id), voucher_code text, created_at timestamptz not null default now());
alter table public.settings enable row level security;
alter table public.prizes enable row level security;
alter table public.vouchers enable row level security;
alter table public.plays enable row level security;
revoke all on public.settings,public.prizes,public.vouchers,public.plays from anon,authenticated;
grant all on public.settings,public.prizes,public.vouchers,public.plays to service_role;
grant usage,select on sequence public.plays_id_seq to service_role;
create function public.save_prize(p_id uuid,p_name text,p_quantity int,p_probability numeric,p_requires_code boolean) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 perform 1 from public.settings where id=1 for update;
 if (select coalesce(sum(probability),0) from public.prizes where id is distinct from p_id)+round(p_probability,2)>100 then raise exception 'PROBABILITY_LIMIT'; end if;
 if p_id is null then insert into public.prizes(name,quantity,probability,requires_code) values(p_name,p_quantity,p_probability,p_requires_code) returning id into result;
 else update public.prizes set name=p_name,quantity=p_quantity,probability=p_probability,requires_code=p_requires_code where id=p_id returning id into result;
 if result is null then raise exception 'PRIZE_NOT_FOUND'; end if; end if;
 return result;
end $$;
create function public.draw(p_name text,p_phone text,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype; existing public.plays%rowtype; p public.prizes%rowtype; v public.vouchers%rowtype; r numeric; cumulative numeric:=0; chosen uuid; reward text:='Chúc may mắn'; saved public.plays%rowtype;
begin
 if p_name is null or length(trim(p_name)) not between 2 and 100 or p_phone is null or p_phone !~ '^0[35789][0-9]{8}$' or p_request is null then raise exception 'INVALID_INPUT'; end if;
 select * into cfg from public.settings where id=1 for update;
 select * into existing from public.plays where request_id=p_request;
 if found then
 if existing.phone<>p_phone or existing.name<>trim(p_name) then raise exception 'INVALID_REQUEST'; end if;
 return to_jsonb(existing); end if;
 if not cfg.active then raise exception 'GAME_CLOSED'; end if;
 if exists(select 1 from public.plays where phone=p_phone) then raise exception 'ALREADY_PLAYED'; end if;
 r:=random()*100;
 for p in select * from public.prizes order by id for update loop
 cumulative:=cumulative+p.probability;
 if r<cumulative then
 if p.quantity>0 then
 if p.requires_code then select * into v from public.vouchers where prize_id=p.id and not used order by id limit 1 for update; end if;
 if not p.requires_code or v.id is not null then chosen:=p.id; reward:=p.name;
 update public.prizes set quantity=quantity-1 where id=p.id;
 if v.id is not null then update public.vouchers set used=true where id=v.id; end if; end if; end if;
 exit; end if; end loop;
 insert into public.plays(request_id,name,phone,prize_id,prize_name,voucher_id,voucher_code) values(p_request,trim(p_name),p_phone,chosen,reward,v.id,v.code) returning * into saved;
 return to_jsonb(saved);
end $$;
revoke execute on function public.draw(text,text,uuid),public.save_prize(uuid,text,integer,numeric,boolean) from public,anon,authenticated;
grant execute on function public.draw(text,text,uuid),public.save_prize(uuid,text,integer,numeric,boolean) to service_role;
commit;