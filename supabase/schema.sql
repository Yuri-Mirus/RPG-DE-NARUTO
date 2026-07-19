-- Execute no SQL Editor do Supabase. Este arquivo cria as permissões do RPG.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;

create type public.rpg_role as enum ('player', 'master', 'admin');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 50),
  role public.rpg_role not null default 'player',
  created_at timestamptz not null default now()
);
create table public.character_sheets (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Ficha sem nome', content text not null default '', updated_at timestamptz not null default now()
);
create unique index one_sheet_per_player on public.character_sheets(owner_id);
create table public.dice_rolls (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, sides int not null check(sides in (5,10,15,20,30)), value int not null, created_at timestamptz not null default now());
create table public.campaign_events (id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id), action text not null, detail text not null, created_at timestamptz not null default now());
create table public.master_notes (id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id), text text not null, created_at timestamptz not null default now());
create table private.role_codes (role public.rpg_role primary key, code_hash text not null);
alter table public.profiles enable row level security; alter table public.character_sheets enable row level security; alter table public.dice_rolls enable row level security; alter table public.campaign_events enable row level security; alter table public.master_notes enable row level security;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select role in ('master','admin') from public.profiles where id=auth.uid()),false) $$;
create policy "profiles read signed in" on public.profiles for select to authenticated using(true);
create policy "own profile update" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid() and role=(select role from public.profiles where id=auth.uid()));
create policy "own sheet read" on public.character_sheets for select to authenticated using(owner_id=auth.uid() or public.is_staff());
create policy "own sheet write" on public.character_sheets for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy "rolls read" on public.dice_rolls for select to authenticated using(true);
create policy "own roll insert" on public.dice_rolls for insert to authenticated with check(user_id=auth.uid());
create policy "events read" on public.campaign_events for select to authenticated using(true);
create policy "staff events write" on public.campaign_events for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "staff notes only" on public.master_notes for all to authenticated using(public.is_staff()) with check(public.is_staff());

create or replace function public.create_profile(name text) returns void language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,display_name) values(auth.uid(),left(trim(name),50)) on conflict(id) do nothing; end $$;
create or replace function public.claim_role(requested public.rpg_role, supplied_code text) returns void language plpgsql security definer set search_path=public,private as $$ begin if requested='player' then return; end if; if not exists (select 1 from private.role_codes where role=requested and crypt(supplied_code,code_hash)=code_hash) then raise exception 'Código inválido'; end if; update public.profiles set role=requested where id=auth.uid(); end $$;
create or replace function public.roll_die(requested_sides int) returns public.dice_rolls language plpgsql security definer set search_path=public as $$ declare result public.dice_rolls; begin if requested_sides not in (5,10,15,20,30) then raise exception 'Dado inválido'; end if; insert into public.dice_rolls(user_id,sides,value) values(auth.uid(),requested_sides,floor(random()*requested_sides+1)::int) returning * into result; return result; end $$;
revoke all on private.role_codes from anon, authenticated; grant execute on function public.create_profile(text), public.claim_role(public.rpg_role,text), public.roll_die(int) to authenticated;
-- Defina códigos fortes (troque os textos antes de executar):
insert into private.role_codes(role,code_hash) values ('master',crypt('TROQUE-MESTRE',gen_salt('bf'))),('admin',crypt('TROQUE-ADMIN',gen_salt('bf')));
