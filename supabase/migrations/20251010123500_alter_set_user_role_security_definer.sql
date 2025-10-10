-- Migration: mark set_user_role as SECURITY DEFINER
-- Ensures the function executes with the privileges of its owner

ALTER FUNCTION public.set_user_role(uuid, text, uuid, uuid) SECURITY DEFINER;

-- Optional: ensure owner is the current role (usually the deployer). Skip changing owner here.
