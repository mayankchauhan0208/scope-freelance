begin;

-- Records user-reported communication activity. These events are not proof of Gmail delivery.
create or replace function public.record_email_client_event(
  p_draft_id uuid,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.activity_logs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  inserted public.activity_logs;
begin
  if actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_event_type not in (
    'email.draft_saved','email.compose_opened','email.marked_sent',
    'email.followup_scheduled','email.reply_marked'
  ) then
    raise exception 'Unsupported email client event.' using errcode = '22023';
  end if;

  if p_draft_id is not null and not exists (
    select 1 from public.drafts d where d.id = p_draft_id and d.user_id = actor
  ) then
    raise exception 'Draft not found or access denied.' using errcode = '42501';
  end if;

  insert into public.activity_logs (user_id, event_type, entity_type, entity_id, metadata)
  values (
    actor,
    p_event_type,
    'draft',
    p_draft_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'trusted', false,
      'verification', 'user_reported',
      'provider_confirmed', false
    )
  )
  returning * into inserted;

  return inserted;
end;
$$;

revoke all on function public.record_email_client_event(uuid, text, jsonb) from public, anon;
grant execute on function public.record_email_client_event(uuid, text, jsonb) to authenticated;

commit;
