-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  location TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  banner_url TEXT,
  cover_url TEXT,
  map_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ticket_types table
CREATE TABLE public.ticket_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sector TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#3B82F6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;

-- Public read access for events
CREATE POLICY "Anyone can read active events"
ON public.events
FOR SELECT
USING (is_active = true);

-- Public read access for ticket types
CREATE POLICY "Anyone can read active ticket types"
ON public.ticket_types
FOR SELECT
USING (is_active = true);

-- Service role can manage all (for admin)
CREATE POLICY "Service role can manage events"
ON public.events
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage ticket types"
ON public.ticket_types
FOR ALL
USING (true)
WITH CHECK (true);