-- Run in the Supabase SQL Editor after supabase-schema.sql and after
-- creating the admin accounts in Authentication with their intended passwords.
-- Add as many emails as needed here. This allows multiple users to access the admin area.
do $$
declare
  admin_emails text[] := array[
    'claudmarsjimenez.afhomes@gmail.com'
  ];
  email_value text;
  admin_id uuid;
begin
  foreach email_value in array admin_emails
  loop
    select id into admin_id
    from auth.users
    where lower(email) = lower(email_value);

    if admin_id is not null then
      insert into public.admin_users (user_id)
      values (admin_id)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;
