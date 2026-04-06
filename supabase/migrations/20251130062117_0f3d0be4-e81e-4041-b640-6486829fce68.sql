-- Add missing columns to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS opening_time TIME,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS youtube_url TEXT,
ADD COLUMN IF NOT EXISTS google_maps_embed TEXT,
ADD COLUMN IF NOT EXISTS event_map_url TEXT;

-- Add batch/lot column and description to ticket_types
ALTER TABLE public.ticket_types
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS batch TEXT DEFAULT 'Lote 1';

-- Create storage bucket for event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to event images
CREATE POLICY "Public can view event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

-- Allow authenticated users to upload event images (admin)
CREATE POLICY "Anyone can upload event images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-images');

-- Allow update and delete
CREATE POLICY "Anyone can update event images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'event-images');

CREATE POLICY "Anyone can delete event images"
ON storage.objects FOR DELETE
USING (bucket_id = 'event-images');