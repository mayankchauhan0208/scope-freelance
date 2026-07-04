begin;

-- Phase 7 adds user-scoped tracker fields without replacing existing opportunity data.
alter table public.opportunities
  add column if not exists next_followup_at timestamptz,
  add column if not exists followup_reason text,
  add column if not exists followup_status text,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists reply_received_at timestamptz,
  add column if not exists followup_notes text,
  add column if not exists communication_status text,
  add column if not exists pipeline_value numeric check (pipeline_value is null or pipeline_value >= 0),
  add column if not exists currency text check (currency is null or currency ~ '^[A-Z]{3}$');

do $$
begin
  if exists (
    select 1 from public.opportunities
    where status not in (
      'discovered','analyzed','shortlisted','saved','draft_prepared','ready_to_apply',
      'applied','proposal_drafted','proposal_sent','email_sent','client_replied',
      'interview','negotiation','hired','rejected','follow_up_needed','no_response',
      'in_progress','submitted','revision_requested','completed','payment_received',
      'client_lost','skipped','archived'
    )
  ) then
    raise exception 'Tracker status preflight failed: unsupported opportunity status exists.';
  end if;

  alter table public.opportunities drop constraint if exists opportunities_status_allowed;
  alter table public.opportunities add constraint opportunities_status_allowed check (
    status in (
      'discovered','analyzed','shortlisted','saved','draft_prepared','ready_to_apply',
      'applied','proposal_drafted','proposal_sent','email_sent','client_replied',
      'interview','negotiation','hired','rejected','follow_up_needed','no_response',
      'in_progress','submitted','revision_requested','completed','payment_received',
      'client_lost','skipped','archived'
    )
  );
end $$;

alter table public.opportunities drop constraint if exists opportunities_followup_status_allowed;
alter table public.opportunities add constraint opportunities_followup_status_allowed
  check (followup_status is null or followup_status in ('scheduled','completed','snoozed'));

alter table public.opportunities drop constraint if exists opportunities_communication_status_allowed;
alter table public.opportunities add constraint opportunities_communication_status_allowed
  check (communication_status is null or communication_status in ('draft_prepared','reviewed','sent_manually','reply_received','follow_up_needed','no_response','closed'));

create index if not exists opportunities_owner_followup_idx
  on public.opportunities (user_id, next_followup_at)
  where next_followup_at is not null;

create or replace function public.record_tracker_client_event(
  p_source_url text,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.activity_logs
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor uuid := auth.uid();
  opportunity_row public.opportunities;
  inserted public.activity_logs;
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if p_event_type not in (
    'tracker.status_changed','tracker.followup_scheduled','tracker.followup_completed',
    'tracker.followup_snoozed','tracker.note_added','tracker.communication_updated',
    'email.marked_sent','email.reply_marked','email.followup_scheduled'
  ) then
    raise exception 'Unsupported client tracker event.';
  end if;
  if octet_length(coalesce(p_metadata,'{}'::jsonb)::text) > 16000 then
    raise exception 'Tracker event metadata is too large.';
  end if;

  select * into opportunity_row
  from public.opportunities
  where user_id = actor and source_url = p_source_url
  limit 1;
  if opportunity_row.id is null then raise exception 'Owned opportunity not found.'; end if;

  insert into public.activity_logs (user_id,event_type,entity_type,entity_id,metadata)
  values (actor,p_event_type,'opportunity',opportunity_row.id,
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('verification','user_reported','provider_confirmed',false))
  returning * into inserted;
  return inserted;
end;
$$;

revoke all on function public.record_tracker_client_event(text,text,jsonb) from public, anon;
grant execute on function public.record_tracker_client_event(text,text,jsonb) to authenticated;

alter table public.opportunities enable row level security;

commit;
