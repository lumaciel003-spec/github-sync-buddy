-- Explicitly deny SELECT on orders to anon/authenticated at the RLS layer.
-- RESTRICTIVE policies are AND-combined with any future PERMISSIVE policy,
-- so this guarantees customer PII stays locked down even if a permissive
-- policy is added later. Backend access continues via the service_role,
-- which bypasses RLS.

DROP POLICY IF EXISTS "Deny direct reads on orders" ON public.orders;

CREATE POLICY "Deny direct reads on orders"
ON public.orders
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (false);

-- Ensure anon/authenticated have no table-level SELECT grant either.
-- Reads must go through edge functions using the service role.
REVOKE SELECT ON public.orders FROM anon;
REVOKE SELECT ON public.orders FROM authenticated;
GRANT ALL ON public.orders TO service_role;
