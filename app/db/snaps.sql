create table snaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  image_url text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);