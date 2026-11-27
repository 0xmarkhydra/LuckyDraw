-- Keep announced prizes immutable after the first real player enters.
create function public.match_guard_rewards_started() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.game_type='match3' and new.match_rewards is distinct from old.match_rewards and exists(select 1 from public.match_sessions where campaign_id=old.id) then
 raise exception 'MATCH_REWARDS_LOCKED';
 end if;
 return new;
end $$;
create trigger match_guard_rewards_started before update of match_rewards on public.settings for each row execute function public.match_guard_rewards_started();
revoke execute on function public.match_guard_rewards_started() from public,anon,authenticated;
