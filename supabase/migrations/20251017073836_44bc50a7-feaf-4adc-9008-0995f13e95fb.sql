-- Add primary key to profiles table if it doesn't exist
DO $$ 
BEGIN
  -- Check if primary key exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_pkey' 
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    -- Add primary key
    ALTER TABLE public.profiles ADD PRIMARY KEY (id);
  END IF;
END $$;