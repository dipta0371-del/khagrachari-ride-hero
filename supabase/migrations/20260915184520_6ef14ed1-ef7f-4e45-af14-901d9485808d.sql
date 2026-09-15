ALTER TABLE public.device_tokens DROP CONSTRAINT IF EXISTS device_tokens_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_user_token_key ON public.device_tokens (user_id, token);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;