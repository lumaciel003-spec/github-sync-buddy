-- Add show_on_home column to events table
ALTER TABLE public.events ADD COLUMN show_on_home boolean NOT NULL DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.events.show_on_home IS 'Controls whether the event appears on the home page';