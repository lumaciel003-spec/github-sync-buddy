
-- Events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  location TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL,
  opening_time TEXT,
  banner_url TEXT,
  cover_url TEXT,
  map_url TEXT,
  event_map_url TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  youtube_url TEXT,
  google_maps_embed TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_on_home BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ticket types table
CREATE TABLE public.ticket_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sector TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  fee NUMERIC NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#000000',
  batch TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  event_id UUID REFERENCES public.events(id),
  customer_name TEXT NOT NULL,
  customer_cpf TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS policies (public read for events and ticket_types, public read for orders by email/cpf)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are publicly readable" ON public.events FOR SELECT USING (true);
CREATE POLICY "Ticket types are publicly readable" ON public.ticket_types FOR SELECT USING (true);
CREATE POLICY "Orders are publicly readable" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Orders can be inserted publicly" ON public.orders FOR INSERT WITH CHECK (true);
