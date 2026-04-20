ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS inactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inactivated_by UUID,
  ADD COLUMN IF NOT EXISTS inactivation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);
CREATE INDEX IF NOT EXISTS idx_members_inactivated_at ON public.members(inactivated_at);