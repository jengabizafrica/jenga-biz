-- Migration: Ensure creating a strategy will create a business if none provided (enforce 1:1)
-- Generated: 2025-10-05

CREATE OR REPLACE FUNCTION public.create_or_update_strategy_with_business(
  p_strategy_data jsonb,
  p_business_data jsonb DEFAULT NULL,
  p_milestones_data jsonb[] DEFAULT '{}'::jsonb[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id uuid;
  v_strategy_id uuid;
  v_milestone jsonb;
  v_result jsonb;
  v_milestones jsonb[] := '{}';
BEGIN
  -- Basic handling: prefer explicit business_id in strategy, then business data, else create a minimal business
  IF p_strategy_data->>'business_id' IS NOT NULL AND p_strategy_data->>'business_id' != '' THEN
    v_business_id := (p_strategy_data->>'business_id')::uuid;
  END IF;

  IF p_business_data IS NOT NULL THEN
    IF p_business_data->>'id' IS NOT NULL AND p_business_data->>'id' != '' THEN
      v_business_id := (p_business_data->>'id')::uuid;
      UPDATE public.businesses
      SET
        name = COALESCE(p_business_data->>'name', name),
        business_type = COALESCE(p_business_data->>'business_type', business_type),
        stage = COALESCE((p_business_data->>'stage')::public.business_stage, stage),
        description = COALESCE(p_business_data->>'description', description),
        registration_number = COALESCE(p_business_data->>'registration_number', registration_number),
        registration_certificate_url = COALESCE(p_business_data->>'registration_certificate_url', registration_certificate_url),
        updated_at = now()
      WHERE id = v_business_id
      RETURNING id INTO v_business_id;
    ELSE
      IF v_business_id IS NOT NULL THEN
        UPDATE public.businesses
        SET
          name = COALESCE(p_business_data->>'name', name),
          business_type = COALESCE(p_business_data->>'business_type', business_type),
          stage = COALESCE((p_business_data->>'stage')::public.business_stage, stage),
          description = COALESCE(p_business_data->>'description', description),
          registration_number = COALESCE(p_business_data->>'registration_number', registration_number),
          registration_certificate_url = COALESCE(p_business_data->>'registration_certificate_url', registration_certificate_url),
          updated_at = now()
        WHERE id = v_business_id
        RETURNING id INTO v_business_id;
      ELSE
        INSERT INTO public.businesses (
          user_id,
          hub_id,
          name,
          business_type,
          stage,
          description,
          registration_number,
          registration_certificate_url,
          is_active
        ) VALUES (
          (p_business_data->>'user_id')::uuid,
          NULLIF(p_business_data->>'hub_id', '')::uuid,
          p_business_data->>'name',
          p_business_data->>'business_type',
          COALESCE((p_business_data->>'stage')::public.business_stage, 'idea'::public.business_stage),
          p_business_data->>'description',
          p_business_data->>'registration_number',
          p_business_data->>'registration_certificate_url',
          COALESCE((p_business_data->>'is_active')::boolean, true)
        )
        RETURNING id INTO v_business_id;
      END IF;
    END IF;

    IF v_business_id IS NOT NULL THEN
      p_strategy_data := jsonb_set(p_strategy_data, '{business_id}', to_jsonb(v_business_id::text));
    END IF;
  END IF;

  -- If still no business_id, create a minimal business when creating a new strategy
  IF (p_strategy_data->>'id' IS NULL OR p_strategy_data->>'id' = '') AND (v_business_id IS NULL) THEN
    INSERT INTO public.businesses (
      user_id,
      name,
      is_active
    ) VALUES (
      (p_strategy_data->>'user_id')::uuid,
      COALESCE(p_strategy_data->>'business_name', 'My Business'),
      true
    ) RETURNING id INTO v_business_id;

    p_strategy_data := jsonb_set(p_strategy_data, '{business_id}', to_jsonb(v_business_id::text));
  END IF;

  -- Create or update strategy: only reference existing strategy columns
  IF p_strategy_data->>'id' IS NOT NULL AND p_strategy_data->>'id' != '' THEN
    UPDATE public.strategies
    SET
      business_id = COALESCE(NULLIF((p_strategy_data->>'business_id'), '')::uuid, business_id),
      business_name = COALESCE(p_strategy_data->>'business_name', business_name),
      vision = COALESCE(p_strategy_data->>'vision', vision),
      mission = COALESCE(p_strategy_data->>'mission', mission),
      target_market = COALESCE(p_strategy_data->>'target_market', target_market),
      revenue_model = COALESCE(p_strategy_data->>'revenue_model', revenue_model),
      value_proposition = COALESCE(p_strategy_data->>'value_proposition', value_proposition),
      key_partners = COALESCE(p_strategy_data->>'key_partners', key_partners),
      marketing_approach = COALESCE(p_strategy_data->>'marketing_approach', marketing_approach),
      operational_needs = COALESCE(p_strategy_data->>'operational_needs', operational_needs),
      growth_goals = COALESCE(p_strategy_data->>'growth_goals', growth_goals),
      updated_at = now()
    WHERE id = (p_strategy_data->>'id')::uuid
    RETURNING id INTO v_strategy_id;
  ELSE
    INSERT INTO public.strategies (
      user_id,
      business_id,
      business_name,
      vision,
      mission,
      target_market,
      revenue_model,
      value_proposition,
      key_partners,
      marketing_approach,
      operational_needs,
      growth_goals
    ) VALUES (
      (p_strategy_data->>'user_id')::uuid,
      NULLIF((p_strategy_data->>'business_id'), '')::uuid,
      p_strategy_data->>'business_name',
      p_strategy_data->>'vision',
      p_strategy_data->>'mission',
      p_strategy_data->>'target_market',
      p_strategy_data->>'revenue_model',
      p_strategy_data->>'value_proposition',
      p_strategy_data->>'key_partners',
      p_strategy_data->>'marketing_approach',
      p_strategy_data->>'operational_needs',
      p_strategy_data->>'growth_goals'
    )
    RETURNING id INTO v_strategy_id;
  END IF;

    -- Remove existing milestones and (re)create if provided
    DELETE FROM public.milestones WHERE strategy_id = v_strategy_id;

    IF p_milestones_data IS NOT NULL AND array_length(p_milestones_data, 1) > 0 THEN
      FOREACH v_milestone IN ARRAY p_milestones_data LOOP
        INSERT INTO public.milestones (
          strategy_id,
          business_id,
          title,
          description,
          status,
          target_date,
          milestone_type,
          completed_at
        ) VALUES (
          v_strategy_id,
          COALESCE(NULLIF((v_milestone->>'business_id'), '')::uuid, NULLIF((p_strategy_data->>'business_id'), '')::uuid),
          v_milestone->>'title',
          v_milestone->>'description',
          COALESCE((v_milestone->>'status')::public.milestone_status, 'pending'::public.milestone_status),
          NULLIF(v_milestone->>'target_date', '')::timestamptz,
          COALESCE((v_milestone->>'milestone_type')::public.milestone_type, 'other'::public.milestone_type),
          CASE WHEN v_milestone->>'completed_at' IS NOT NULL AND v_milestone->>'completed_at' != '' THEN (v_milestone->>'completed_at')::timestamptz ELSE NULL END
        )
        RETURNING to_jsonb(milestones.*) INTO v_milestone;

        v_milestones := array_append(v_milestones, v_milestone);
      END LOOP;
    END IF;

    -- Return the created/updated strategy with its business and milestones
    SELECT jsonb_build_object(
      'strategy', to_jsonb(s) || jsonb_build_object(
        'milestones', COALESCE((SELECT jsonb_agg(m.*) FROM public.milestones m WHERE m.strategy_id = s.id), '[]'::jsonb)
      ),
      'business', (SELECT to_jsonb(b.*) FROM public.businesses b WHERE b.id = s.business_id)
    ) INTO v_result
    FROM public.strategies s
    WHERE s.id = v_strategy_id;

    RETURN v_result;

  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error in create_or_update_strategy_with_business: %', SQLERRM;
  END;
$$;

GRANT EXECUTE ON FUNCTION public.create_or_update_strategy_with_business(jsonb, jsonb, jsonb[]) TO authenticated;
