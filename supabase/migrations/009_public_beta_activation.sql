begin;

-- Keep historical feedback values valid while accepting the clearer launch
-- categories shown to customers in Phase 20.
alter table public.feedback drop constraint if exists feedback_feedback_type_check;
alter table public.feedback drop constraint if exists feedback_type_check;
alter table public.feedback
  add constraint feedback_feedback_type_check
  check (feedback_type in (
    'Login issue','Resume analyzer issue','Search result issue',
    'Application packet issue','Draft issue','Tracker/follow-up issue',
    'Mobile/UI issue','Other',
    'Bug','Confusing UI','Bad job match','Resume issue','Feature request'
  ));

-- Aggregate-only launch monitoring. No private resume, opportunity, draft, or
-- contact content is returned to the admin client.
create or replace function public.admin_launch_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_roledesk_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'feedback', (select count(*) from public.feedback),
    'unresolved_feedback', (select count(*) from public.feedback where status not in ('fixed','archived')),
    'opportunities', (select count(*) from public.opportunities),
    'drafts', (select count(*) from public.drafts),
    'followups', (select count(*) from public.opportunities where next_followup_at is not null and followup_status is distinct from 'completed')
  );
end;
$$;

revoke all on function public.admin_launch_metrics() from public, anon;
grant execute on function public.admin_launch_metrics() to authenticated;

commit;
