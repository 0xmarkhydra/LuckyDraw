-- Save the reward and its voucher batch as one transaction.
create function public.campaign_save_reward(p_campaign integer,p_id uuid,p_revision bigint,p_name text,p_quantity integer,p_unlimited boolean,p_requires_code boolean,p_weight integer,p_codes text[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.settings%rowtype; reward_id uuid; imported integer:=0; n integer; qty integer:=p_quantity;
begin
 select * into cfg from public.settings where id=p_campaign for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
 if cfg.active then raise exception 'PAUSE_CAMPAIGN'; end if;
 if p_codes is null or cardinality(p_codes)>5000 or exists(select 1 from unnest(p_codes) c where c is null or length(trim(c)) not between 1 and 200) then raise exception 'INVALID_CODES'; end if;
 select count(distinct trim(c)) into n from unnest(p_codes) c;
 if n>0 and (p_unlimited or not p_requires_code) then raise exception 'INVALID_VOUCHER_PRIZE'; end if;
 if p_id is null and p_requires_code then
  if n=0 then raise exception 'VOUCHER_REQUIRED'; end if;
  qty:=n;
 elsif p_id is null and not p_unlimited and (qty is null or qty<1) then raise exception 'INVALID_PRIZE'; end if;
 if exists(select 1 from public.vouchers v where v.campaign_id=p_campaign and v.code in(select trim(c) from unnest(p_codes) c) and (p_id is null or v.prize_id<>p_id)) then raise exception 'VOUCHER_OTHER_REWARD'; end if;
 reward_id:=public.campaign_save_prize(p_campaign,p_id,p_revision,p_name,qty,p_unlimited,p_requires_code,p_weight);
 if n>0 then imported:=public.campaign_import(p_campaign,reward_id,p_codes); end if;
 return jsonb_build_object('prizeId',reward_id,'imported',imported,'quantity',qty);
end $$;
revoke execute on function public.campaign_save_reward(integer,uuid,bigint,text,integer,boolean,boolean,integer,text[]) from public,anon,authenticated;
grant execute on function public.campaign_save_reward(integer,uuid,bigint,text,integer,boolean,boolean,integer,text[]) to service_role;
