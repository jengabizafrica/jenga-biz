-- Phase 1: Rename maintenance_mode to demo_mode in app_settings
UPDATE app_settings 
SET 
  key = 'demo_mode',
  description = 'When enabled, all entrepreneurs get Free tier features without expiration (demo/testing phase). Bypasses trial period for Free tier users.'
WHERE key = 'maintenance_mode';

-- Phase 2: Add comment to clarify demo mode behavior
COMMENT ON TABLE app_settings IS 'Application-wide settings. demo_mode=true gives Free tier users indefinite access with enforced limits.';