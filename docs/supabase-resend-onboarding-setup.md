# Supabase + Resend Setup

The app now assumes this onboarding flow:

1. User answers onboarding questions by typing or recording.
2. User enters twin name, email, and password.
3. User confirms email with a 6-digit code.
4. User picks a plan and pays.
5. Onboarding continues into birthing/dashboard.

This order keeps a real Supabase user session in place before checkout so onboarding data can be written safely to Supabase.

## 1. Configure Resend SMTP for Supabase Auth

In Resend:

1. Verify your sending domain.
2. Create an API key.
3. Use these SMTP credentials:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend API key

In Supabase:

1. Open `Authentication`.
2. Open the email / notifications section.
3. Enable custom SMTP.
4. Set:
   - Sender email: `noreply@yourdomain.com`
   - Sender name: `CyberTwin`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend API key
5. Keep `Confirm email` enabled.

## 2. Switch signup confirmation from link to code

In Supabase `Authentication -> Email Templates`:

1. Open the `Confirm signup` template.
2. Replace the link-style variable with the token variable.

Example:

```html
<h2>Confirm your email</h2>
<p>Your CyberTwin verification code is:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:0.2em;">{{ .Token }}</p>
```

Do not use `{{ .ConfirmationURL }}` in that template if you want a code-based confirmation flow.

## 3. Add the onboarding profile fields

Run this in the Supabase SQL editor:

```sql
alter table public.profiles add column if not exists twin_name text;
alter table public.profiles add column if not exists onboarding_mode text;
alter table public.profiles add column if not exists onboarding_answers jsonb;
alter table public.profiles add column if not exists onboarding_character_profile text;
alter table public.profiles add column if not exists onboarding_photo_path text;
alter table public.profiles add column if not exists onboarding_audio_path text;
alter table public.profiles add column if not exists selected_plan text;
alter table public.profiles add column if not exists onboarding_updated_at timestamptz;
alter table public.profiles add column if not exists onboarding_paid_at timestamptz;

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      to authenticated
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own'
  ) then
    create policy profiles_insert_own
      on public.profiles
      for insert
      to authenticated
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own
      on public.profiles
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end
$$;
```

## 4. Create storage buckets for onboarding assets

Run this in the Supabase SQL editor too:

```sql
insert into storage.buckets (id, name, public)
values ('onboarding-photos', 'onboarding-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('onboarding-audio', 'onboarding-audio', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'onboarding_photos_select_own'
  ) then
    create policy onboarding_photos_select_own
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'onboarding-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'onboarding_photos_insert_own'
  ) then
    create policy onboarding_photos_insert_own
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'onboarding-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'onboarding_photos_update_own'
  ) then
    create policy onboarding_photos_update_own
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'onboarding-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'onboarding-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'onboarding_audio_select_own'
  ) then
    create policy onboarding_audio_select_own
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'onboarding-audio'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'onboarding_audio_insert_own'
  ) then
    create policy onboarding_audio_insert_own
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'onboarding-audio'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'onboarding_audio_update_own'
  ) then
    create policy onboarding_audio_update_own
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'onboarding-audio'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'onboarding-audio'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end
$$;
```

## 5. What the app writes now

After email verification and before pricing:

- `profiles.twin_name`
- `profiles.onboarding_mode`
- `profiles.onboarding_answers`
- `profiles.onboarding_character_profile`
- `profiles.onboarding_photo_path`
- `profiles.onboarding_audio_path`

After payment succeeds:

- `profiles.selected_plan`
- `profiles.onboarding_paid_at`

The generated cyborg profile image still uses the existing `profile-images` bucket.
