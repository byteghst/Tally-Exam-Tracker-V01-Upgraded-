-- Applied to the production project on 2026-11-02.
-- Security hardening: grants, policies, functions.

-- 1. Privileges: anon gets nothing on app tables; authenticated gets DML only.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;

-- 2. Policies: authenticated role only, initplan-friendly auth.uid(), same-owner checks on references.
drop policy if exists "own app_settings" on public.app_settings;
create policy "own app_settings" on public.app_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own deadlines" on public.deadlines;
create policy "own deadlines" on public.deadlines for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own exam_configs" on public.exam_configs;
create policy "own exam_configs" on public.exam_configs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own exam_config_types" on public.exam_config_types;
create policy "own exam_config_types" on public.exam_config_types for all to authenticated
  using (exists (select 1 from public.exam_configs c where c.id = exam_config_types.config_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.exam_configs c where c.id = exam_config_types.config_id and c.user_id = (select auth.uid())));

drop policy if exists "own exams" on public.exams;
create policy "own exams" on public.exams for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (config_id is null or exists (select 1 from public.exam_configs c where c.id = exams.config_id and c.user_id = (select auth.uid())))
  );

drop policy if exists "own prayer_log" on public.prayer_log;
create policy "own prayer_log" on public.prayer_log for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own study_subjects" on public.study_subjects;
create policy "own study_subjects" on public.study_subjects for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own study_tags" on public.study_tags;
create policy "own study_tags" on public.study_tags for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own study_sessions" on public.study_sessions;
create policy "own study_sessions" on public.study_sessions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.study_subjects s where s.id = study_sessions.subject_id and s.user_id = (select auth.uid()))
    and (tag_id is null or exists (select 1 from public.study_tags t where t.id = study_sessions.tag_id and t.user_id = (select auth.uid())))
  );

drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 3. Functions
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
alter function public.set_updated_at() set search_path = '';
