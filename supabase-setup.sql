-- =============================================
-- STREAM APP - To'liq Supabase Setup
-- SQL Editor da ishga tushiring
-- =============================================

-- 1. PROFILES jadvalini kengaytirish
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists bio text,
  add column if not exists subscribers_count integer default 0,
  add column if not exists videos_count integer default 0;

-- 2. VIDEOS jadvali
create table if not exists public.videos (
  id            uuid default gen_random_uuid() primary key,
  channel_id    uuid references public.profiles(id) on delete cascade not null,
  title         text not null,
  description   text,
  video_url     text not null,
  thumbnail_url text,
  duration      integer default 0,
  views_count   integer default 0,
  likes_count   integer default 0,
  comments_count integer default 0,
  is_published  boolean default true,
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

-- 3. LIKES jadvali
create table if not exists public.likes (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  video_id   uuid references public.videos(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  unique(user_id, video_id)
);

-- 4. COMMENTS jadvali
create table if not exists public.comments (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  video_id   uuid references public.videos(id) on delete cascade not null,
  parent_id  uuid references public.comments(id) on delete cascade,
  content    text not null,
  likes_count integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 5. SUBSCRIPTIONS jadvali
create table if not exists public.subscriptions (
  id           uuid default gen_random_uuid() primary key,
  subscriber_id uuid references public.profiles(id) on delete cascade not null,
  channel_id    uuid references public.profiles(id) on delete cascade not null,
  created_at    timestamp with time zone default now(),
  unique(subscriber_id, channel_id),
  check(subscriber_id != channel_id)
);

-- 6. WATCH_HISTORY jadvali
create table if not exists public.watch_history (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references public.profiles(id) on delete cascade not null,
  video_id         uuid references public.videos(id) on delete cascade not null,
  progress_seconds integer default 0,
  watched_at       timestamp with time zone default now(),
  unique(user_id, video_id)
);

-- 7. NOTIFICATIONS jadvali
create table if not exists public.notifications (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references public.profiles(id) on delete cascade not null,
  from_user_id uuid references public.profiles(id) on delete cascade,
  video_id     uuid references public.videos(id) on delete cascade,
  type         text not null check(type in ('like','comment','subscribe','reply')),
  message      text,
  is_read      boolean default false,
  created_at   timestamp with time zone default now()
);

-- =============================================
-- RLS (Row Level Security)
-- =============================================

alter table public.videos       enable row level security;
alter table public.likes        enable row level security;
alter table public.comments     enable row level security;
alter table public.subscriptions enable row level security;
alter table public.watch_history enable row level security;
alter table public.notifications enable row level security;

-- VIDEOS policies
create policy "Hamma video ko'ra oladi"
  on videos for select using (is_published = true);

create policy "Kanal egasi video qo'sha oladi"
  on videos for insert with check (auth.uid() = channel_id);

create policy "Kanal egasi video yangilay oladi"
  on videos for update using (auth.uid() = channel_id);

create policy "Kanal egasi video o'chira oladi"
  on videos for delete using (auth.uid() = channel_id);

-- LIKES policies
create policy "Hamma like ko'ra oladi"
  on likes for select using (true);

create policy "Login qilgan like bosa oladi"
  on likes for insert with check (auth.uid() = user_id);

create policy "O'z likeini o'chira oladi"
  on likes for delete using (auth.uid() = user_id);

-- COMMENTS policies
create policy "Hamma comment ko'ra oladi"
  on comments for select using (true);

create policy "Login qilgan comment yoza oladi"
  on comments for insert with check (auth.uid() = user_id);

create policy "O'z commentini yangilay oladi"
  on comments for update using (auth.uid() = user_id);

create policy "O'z commentini o'chira oladi"
  on comments for delete using (auth.uid() = user_id);

-- SUBSCRIPTIONS policies
create policy "Hamma subscription ko'ra oladi"
  on subscriptions for select using (true);

create policy "O'zi subscribe bo'la oladi"
  on subscriptions for insert with check (auth.uid() = subscriber_id);

create policy "O'zi unsubscribe qila oladi"
  on subscriptions for delete using (auth.uid() = subscriber_id);

-- WATCH_HISTORY policies
create policy "Faqat o'zining tarixini ko'ra oladi"
  on watch_history for select using (auth.uid() = user_id);

create policy "O'z tarixini qo'sha oladi"
  on watch_history for insert with check (auth.uid() = user_id);

create policy "O'z tarixini yangilay oladi"
  on watch_history for update using (auth.uid() = user_id);

create policy "O'z tarixini o'chira oladi"
  on watch_history for delete using (auth.uid() = user_id);

-- NOTIFICATIONS policies
create policy "Faqat o'zining bildirishnomalarini ko'ra oladi"
  on notifications for select using (auth.uid() = user_id);

create policy "Bildirishnoma yaratish"
  on notifications for insert with check (true);

create policy "O'z bildirishnomalarini yangilay oladi"
  on notifications for update using (auth.uid() = user_id);

-- =============================================
-- TRIGGERS - Avtomatik counter yangilash
-- =============================================

-- Like qo'shilganda video likes_count oshadi
create or replace function handle_like_insert()
returns trigger as $$
begin
  update videos set likes_count = likes_count + 1 where id = new.video_id;
  -- Notification yaratish
  insert into notifications(user_id, from_user_id, video_id, type, message)
  select v.channel_id, new.user_id, new.video_id, 'like', 'Videongizga like bosildi'
  from videos v where v.id = new.video_id and v.channel_id != new.user_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_like_insert
  after insert on likes
  for each row execute procedure handle_like_insert();

-- Like o'chirilganda likes_count kamayadi
create or replace function handle_like_delete()
returns trigger as $$
begin
  update videos set likes_count = greatest(likes_count - 1, 0) where id = old.video_id;
  return old;
end;
$$ language plpgsql security definer;

create trigger on_like_delete
  after delete on likes
  for each row execute procedure handle_like_delete();

-- Comment qo'shilganda comments_count oshadi
create or replace function handle_comment_insert()
returns trigger as $$
begin
  update videos set comments_count = comments_count + 1 where id = new.video_id;
  -- Notification yaratish
  insert into notifications(user_id, from_user_id, video_id, type, message)
  select v.channel_id, new.user_id, new.video_id, 'comment', 'Videongizga comment yozildi'
  from videos v where v.id = new.video_id and v.channel_id != new.user_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_comment_insert
  after insert on comments
  for each row execute procedure handle_comment_insert();

-- Comment o'chirilganda comments_count kamayadi
create or replace function handle_comment_delete()
returns trigger as $$
begin
  update videos set comments_count = greatest(comments_count - 1, 0) where id = old.video_id;
  return old;
end;
$$ language plpgsql security definer;

create trigger on_comment_delete
  after delete on comments
  for each row execute procedure handle_comment_delete();

-- Subscribe bo'lganda subscribers_count oshadi
create or replace function handle_subscribe_insert()
returns trigger as $$
begin
  update profiles set subscribers_count = subscribers_count + 1 where id = new.channel_id;
  -- Notification yaratish
  insert into notifications(user_id, from_user_id, type, message)
  values(new.channel_id, new.subscriber_id, 'subscribe', 'Kanalingizga yangi obunachilik');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_subscribe_insert
  after insert on subscriptions
  for each row execute procedure handle_subscribe_insert();

-- Unsubscribe bo'lganda subscribers_count kamayadi
create or replace function handle_subscribe_delete()
returns trigger as $$
begin
  update profiles set subscribers_count = greatest(subscribers_count - 1, 0) where id = old.channel_id;
  return old;
end;
$$ language plpgsql security definer;

create trigger on_subscribe_delete
  after delete on subscriptions
  for each row execute procedure handle_subscribe_delete();

-- Video yuklanganda videos_count oshadi
create or replace function handle_video_insert()
returns trigger as $$
begin
  update profiles set videos_count = videos_count + 1 where id = new.channel_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_video_insert
  after insert on videos
  for each row execute procedure handle_video_insert();

-- Video o'chirilganda videos_count kamayadi
create or replace function handle_video_delete()
returns trigger as $$
begin
  update profiles set videos_count = greatest(videos_count - 1, 0) where id = old.channel_id;
  return old;
end;
$$ language plpgsql security definer;

create trigger on_video_delete
  after delete on videos
  for each row execute procedure handle_video_delete();

-- =============================================
-- STORAGE BUCKETS
-- Dashboard > Storage > New bucket orqali yarating:
-- 1. "videos"     - Public: true
-- 2. "thumbnails" - Public: true
-- 3. "avatars"    - Public: true
-- =============================================
