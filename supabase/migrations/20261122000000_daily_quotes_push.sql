-- Daily motivational quote: admin list, quotes, device tokens, card storage.

-- 1. Admins. No write policies on purpose: rows are added only with the SQL editor / service role.
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
create policy "admins read own row" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2. Quotes.
create table public.daily_quotes (
  id uuid primary key default gen_random_uuid(),
  quote text not null check (char_length(quote) between 1 and 600),
  author text not null check (char_length(author) between 1 and 120),
  source text not null check (char_length(source) between 1 and 300),
  card_path text,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'failed')),
  claimed_at timestamptz,
  sent_at timestamptz,
  recipients integer,
  created_at timestamptz not null default now()
);
create index daily_quotes_due_idx on public.daily_quotes (status, scheduled_at);
create index daily_quotes_sent_idx on public.daily_quotes (sent_at desc) where status = 'sent';
alter table public.daily_quotes enable row level security;

-- Signed-in users only ever see quotes that were already sent; scheduled ones stay private.
create policy "read sent quotes, admin reads all" on public.daily_quotes
  for select to authenticated
  using (status = 'sent' or public.is_admin());
create policy "admin inserts quotes" on public.daily_quotes
  for insert to authenticated
  with check (public.is_admin());
create policy "admin updates quotes" on public.daily_quotes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy "admin deletes quotes" on public.daily_quotes
  for delete to authenticated
  using (public.is_admin());

-- 3. Device tokens. RLS on with no policies: reachable only through the two functions below and the service role.
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;

create or replace function public.register_push_token(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 4096 then
    raise exception 'invalid token';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), coalesce(p_platform, 'android'), now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- 4. Card images: public bucket (the notification image needs a plain URL), random file names,
-- only the admin can write; the dispatch function deletes each file 24 hours after sending.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-cards', 'quote-cards', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "quote cards: admin reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'quote-cards' and public.is_admin());
create policy "quote cards: admin uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'quote-cards' and public.is_admin());
create policy "quote cards: admin updates" on storage.objects
  for update to authenticated
  using (bucket_id = 'quote-cards' and public.is_admin())
  with check (bucket_id = 'quote-cards' and public.is_admin());
create policy "quote cards: admin deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'quote-cards' and public.is_admin());

-- Not part of this migration (project-specific, applied separately):
--   insert into public.admins (user_id) values ('<ADMIN_USER_ID>');
--   create extension if not exists pg_cron with schema pg_catalog;
--   create extension if not exists pg_net with schema extensions;
--   select cron.schedule('dispatch-quotes', '* * * * *', $cron$
--     select net.http_post(
--       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/dispatch-quotes',
--       headers := '{"Content-Type":"application/json"}'::jsonb,
--       body := '{}'::jsonb,
--       timeout_milliseconds := 55000
--     )
--     where exists (
--       select 1 from public.daily_quotes
--       where (status = 'scheduled' and scheduled_at <= now())
--          or (status = 'sending' and claimed_at < now() - interval '10 minutes')
--          or (card_path is not null and status = 'sent' and sent_at < now() - interval '24 hours')
--          or (card_path is not null and status = 'failed' and created_at < now() - interval '24 hours')
--     );
--   $cron$);
-- The Edge Function needs the FIREBASE_SERVICE_ACCOUNT secret (Firebase service-account key JSON).
