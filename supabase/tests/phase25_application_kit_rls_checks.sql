begin;

select plan(10);

select ok(
  exists(select 1 from pg_tables where schemaname='public' and tablename='application_kits'),
  'application_kits table exists'
);
select ok(
  exists(select 1 from pg_tables where schemaname='public' and tablename='application_assets'),
  'application_assets table exists'
);
select ok(
  exists(select 1 from pg_tables where schemaname='public' and tablename='export_history'),
  'export_history table exists'
);
select ok(
  exists(select 1 from pg_tables where schemaname='public' and tablename='content_quality_scores'),
  'content_quality_scores table exists'
);

select ok((select relrowsecurity from pg_class where oid='public.application_kits'::regclass), 'application_kits RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.application_assets'::regclass), 'application_assets RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.export_history'::regclass), 'export_history RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.content_quality_scores'::regclass), 'content_quality_scores RLS enabled');

select throws_ok(
  $$ insert into public.application_kits (user_id,title) values (gen_random_uuid(),'Anon kit') $$,
  null,
  'anon cannot insert application kits'
);

select throws_ok(
  $$ insert into public.application_assets (user_id,asset_type,content) values (gen_random_uuid(),'cover_letter','test') $$,
  null,
  'anon cannot insert application assets'
);

select * from finish();
rollback;
