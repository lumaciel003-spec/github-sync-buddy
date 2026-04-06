-- Add event_id column to orders table to link orders to events
ALTER TABLE public.orders ADD COLUMN event_id uuid REFERENCES public.events(id);

-- Create index for better query performance
CREATE INDEX idx_orders_event_id ON public.orders(event_id);