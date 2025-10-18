-- Phase 1: Add new columns to subscription_plans
ALTER TABLE subscription_plans 
  ADD COLUMN IF NOT EXISTS tier VARCHAR(50),
  ADD COLUMN IF NOT EXISTS trial_period_days INTEGER DEFAULT 0;

-- Update Free plan with new structure
UPDATE subscription_plans
SET 
  tier = 'free',
  trial_period_days = 14,
  features = jsonb_build_object(
    'limits', jsonb_build_object(
      'businesses', 1,
      'strategies', 1,
      'milestones', jsonb_build_object(
        'total', 20,
        'stages', jsonb_build_array('concept', 'early_stage')
      ),
      'financial_tracking', jsonb_build_object(
        'receipts_per_month', 0,
        'ocr_enabled', false
      ),
      'ai_summary', jsonb_build_object(
        'type', 'none',
        'count', '0'
      ),
      'share_download', jsonb_build_object(
        'whatsapp', 'unlimited',
        'email', 'unlimited',
        'downloads_per_month', 0,
        'formats', jsonb_build_array()
      )
    ),
    'features', jsonb_build_object(
      'business_strategy', 'Full access for the first 14 days',
      'milestones', 'All stages, up to 20 milestones',
      'financial_tracking', 'Basic tracking without OCR',
      'ai_summary', 'Not available',
      'share_download', 'Unlimited WhatsApp/email'
    )
  )
WHERE name = 'Free';

-- Update Essential plan with new structure
UPDATE subscription_plans
SET 
  tier = 'essential',
  trial_period_days = 0,
  features = jsonb_build_object(
    'limits', jsonb_build_object(
      'businesses', 1,
      'strategies', 1,
      'milestones', jsonb_build_object(
        'total', 20,
        'stages', jsonb_build_array('concept', 'early_stage')
      ),
      'financial_tracking', jsonb_build_object(
        'receipts_per_month', 100,
        'ocr_enabled', true
      ),
      'ai_summary', jsonb_build_object(
        'type', 'lite',
        'count', 'unlimited'
      ),
      'share_download', jsonb_build_object(
        'whatsapp', 'unlimited',
        'email', 'unlimited',
        'downloads_per_month', 5,
        'formats', jsonb_build_array('pdf')
      )
    ),
    'features', jsonb_build_object(
      'business_strategy', 'All templates + start from scratch (1 strategy project)',
      'milestones', 'Concept + early stage, up to 20 milestones (with suggestions)',
      'financial_tracking', '100 receipts/month (OCR + categorization)',
      'ai_summary', 'Unlimited lite summaries',
      'share_download', 'Unlimited WhatsApp/email, 5 downloads/month'
    )
  )
WHERE name = 'Essential';

-- Update Pro plan with new structure
UPDATE subscription_plans
SET 
  tier = 'pro',
  trial_period_days = 0,
  features = jsonb_build_object(
    'limits', jsonb_build_object(
      'businesses', 10,
      'strategies', 10,
      'milestones', jsonb_build_object(
        'total', -1,
        'stages', jsonb_build_array('idea', 'concept', 'early_stage', 'growth', 'mature')
      ),
      'financial_tracking', jsonb_build_object(
        'receipts_per_month', -1,
        'ocr_enabled', true
      ),
      'ai_summary', jsonb_build_object(
        'type', 'advanced',
        'count', 'unlimited'
      ),
      'share_download', jsonb_build_object(
        'whatsapp', 'unlimited',
        'email', 'unlimited',
        'downloads_per_month', -1,
        'formats', jsonb_build_array('pdf', 'excel')
      )
    ),
    'features', jsonb_build_object(
      'business_strategy', 'Multiple strategy projects',
      'milestones', 'All stages, unlimited milestones (with AI suggestions)',
      'financial_tracking', 'Unlimited receipts with OCR + auto-categorization',
      'ai_summary', 'Unlimited advanced summaries (trends + insights)',
      'share_download', 'Unlimited (WhatsApp, email, PDF/Excel)'
    )
  )
WHERE name = 'Pro';