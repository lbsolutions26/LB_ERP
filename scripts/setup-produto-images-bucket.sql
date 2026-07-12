-- Bucket publico para imagens de produtos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'produto-images',
  'produto-images',
  true,
  10485760,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Leitura publica
drop policy if exists "produto_images_public_read" on storage.objects;
create policy "produto_images_public_read"
on storage.objects
for select
to public
using (bucket_id = 'produto-images');

-- Upload autenticado (app)
drop policy if exists "produto_images_auth_insert" on storage.objects;
create policy "produto_images_auth_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'produto-images');

drop policy if exists "produto_images_auth_update" on storage.objects;
create policy "produto_images_auth_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'produto-images')
with check (bucket_id = 'produto-images');

