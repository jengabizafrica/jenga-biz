# Database Schema Documentation

## Overview
The Jenga Biz Africa platform uses PostgreSQL via Supabase with a comprehensive schema designed to support both B2C entrepreneurs and B2B ecosystem builders. The database implements Row Level Security (RLS) for data protection and uses UUID primary keys throughout.

## Database Technology
- **Database**: PostgreSQL (via Supabase)
- **Justification**: ACID compliance, JSON support, excellent performance, managed scaling, built-in auth
- **Documentation**: https://www.postgresql.org/docs/ | https://supabase.com/docs/guides/database

## Core Entity Relationships

### User Management & Authentication

#### `profiles` Table
**Purpose**: Extended user profile information beyond Supabase auth
```sql
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  organization_name TEXT,
  account_type TEXT DEFAULT 'Business', -- 'Business' | 'Organization'
  industry TEXT,
  country TEXT,
  profile_picture_url TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```
**Relationships**: 1:1 with auth.users, 1:many with businesses, strategies, user_roles

#### `user_roles` Table  
**Purpose**: Role-based access control (RBAC)
```sql
user_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  role TEXT NOT NULL, -- 'entrepreneur' | 'hub_manager' | 'admin' | 'super_admin'
  assigned_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```
**Business Rules**:
- Users can have multiple roles
- Role assignments are audited
- RLS ensures users only see appropriate data

### Business Entities

#### `businesses` Table
**Purpose**: Business entities created by entrepreneurs
```sql
businesses (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  business_type TEXT,
  stage business_stage, -- ENUM: 'idea', 'startup', 'growth', 'mature'
  registration_number TEXT,
  hub_id UUID REFERENCES hubs(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

#### `strategies` Table
**Purpose**: Business strategy documents and plans
```sql
strategies (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  business_name TEXT,
  vision TEXT,
  mission TEXT,
  target_market TEXT,
  value_proposition TEXT,
  revenue_model TEXT,
  key_partners TEXT,
  marketing_approach TEXT,
  operational_needs TEXT,
  growth_goals TEXT,
  template_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

### Financial Management

#### `financial_transactions` Table
**Purpose**: Revenue and expense tracking
```sql
financial_transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  strategy_id UUID REFERENCES strategies(id),
  amount DECIMAL NOT NULL,
  transaction_type TEXT NOT NULL, -- 'income' | 'expense'
  category TEXT NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL,
  currency TEXT DEFAULT 'KES',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

#### `financial_records` Table (Legacy/Alternative)
**Purpose**: Business financial records (may be deprecated in favor of financial_transactions)
```sql
financial_records (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  revenue DECIMAL,
  expenses DECIMAL,
  currency TEXT DEFAULT 'USD',
  record_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

### Milestone & Progress Tracking

#### `milestones` Table
**Purpose**: Business milestone and goal tracking
```sql
milestones (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  strategy_id UUID REFERENCES strategies(id),
  title TEXT NOT NULL,
  status TEXT DEFAULT 'not-started', -- 'not-started' | 'in-progress' | 'complete' | 'overdue'
  target_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  business_stage TEXT, -- 'ideation' | 'early' | 'growth'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

#### `business_milestones` Table
**Purpose**: Predefined milestone tracking for businesses
```sql
business_milestones (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  milestone_type milestone_type, -- ENUM: 'registration', 'first_sale', 'hiring', etc.
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

### Ecosystem Builder Features (B2B)

#### `hubs` Table
**Purpose**: Accelerators, incubators, and ecosystem organizations
```sql
hubs (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  hub_type TEXT, -- 'accelerator' | 'incubator' | 'government' | 'ngo'
  location TEXT,
  website TEXT,
  contact_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

#### `cohorts` Table
**Purpose**: Program cohorts managed by ecosystem builders
```sql
cohorts (
  id UUID PRIMARY KEY,
  hub_id UUID REFERENCES hubs(id),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active', -- 'active' | 'completed' | 'cancelled'
  manager_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

#### `cohort_members` Table
**Purpose**: Entrepreneurs enrolled in specific cohorts
```sql
cohort_members (
  id UUID PRIMARY KEY,
  cohort_id UUID REFERENCES cohorts(id),
  business_id UUID REFERENCES businesses(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active', -- 'active' | 'completed' | 'dropped_out'
  completion_date TIMESTAMP WITH TIME ZONE,
  notes TEXT
)
```

### Analytics & Reporting

#### `analytics_summaries` Table
**Purpose**: Aggregated metrics for dashboards
```sql
analytics_summaries (
  id UUID PRIMARY KEY,
  metric_type TEXT NOT NULL, -- 'daily_revenue', 'milestone_completion', etc.
  metric_date DATE NOT NULL,
  metric_value DECIMAL DEFAULT 0,
  additional_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

#### `business_progress_stages` Table
**Purpose**: Track user progress through different business building stages
```sql
business_progress_stages (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  strategy_id UUID REFERENCES strategies(id),
  stage_name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER,
  total_form_fields INTEGER,
  form_fields_completed INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

### Impact Measurement

#### `business_survival_records` Table
**Purpose**: Track business longevity and success metrics
```sql
business_survival_records (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  assessment_date DATE DEFAULT CURRENT_DATE,
  months_in_operation INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  employee_count INTEGER,
  revenue_trend TEXT, -- 'increasing' | 'stable' | 'decreasing'
  survival_risk_score DECIMAL, -- 0-1 scale
  risk_factors TEXT[],
  support_interventions TEXT[],
  closure_date DATE,
  closure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

#### `finance_access_records` Table
**Purpose**: Track funding access and financial inclusion
```sql
finance_access_records (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  funding_type TEXT NOT NULL, -- 'loan' | 'grant' | 'investment' | 'microfinance'
  funding_source TEXT NOT NULL,
  amount_requested DECIMAL,
  amount_approved DECIMAL,
  amount_disbursed DECIMAL,
  interest_rate DECIMAL,
  loan_term_months INTEGER,
  application_status TEXT, -- 'pending' | 'approved' | 'rejected' | 'disbursed'
  rejection_reason TEXT,
  purpose TEXT,
  record_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

### Authentication & Security

#### `user_activities` Table
**Purpose**: Activity logging for analytics and security
```sql
user_activities (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  activity_type TEXT NOT NULL, -- 'login' | 'logout' | 'strategy_created' | etc.
  activity_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

#### `invite_codes` Table
**Purpose**: Invitation system for controlled access
```sql
invite_codes (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  account_type TEXT DEFAULT 'Business',
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

## Missing Tables (Required for Full Implementation)

### Subscription Management (B2C Revenue)
```sql
-- Required for B2C subscription model
subscription_plans (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL, -- 'Free' | 'Basic' | 'Premium'
  price DECIMAL NOT NULL, -- Testing phase: all = 1
  currency TEXT DEFAULT 'KES',
  billing_cycle TEXT DEFAULT 'monthly', -- 'monthly' | 'yearly'
  features JSONB, -- Feature access matrix
  max_strategies INTEGER,
  max_milestones INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

user_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  plan_id UUID REFERENCES subscription_plans(id),
  status TEXT DEFAULT 'active', -- 'active' | 'cancelled' | 'expired'
  current_period_start DATE,
  current_period_end DATE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

payments (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  subscription_id UUID REFERENCES user_subscriptions(id),
  amount DECIMAL NOT NULL,
  currency TEXT NOT NULL,
  payment_method TEXT, -- 'card' | 'mobile_money' | 'bank_transfer'
  paystack_reference TEXT UNIQUE,
  status TEXT DEFAULT 'pending', -- 'pending' | 'success' | 'failed'
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Resource Management
```sql
-- Required for resource library feature
resources (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT, -- 'article' | 'template' | 'video' | 'course'
  content_url TEXT,
  content_body TEXT,
  target_stage TEXT[], -- Which business stages this applies to
  tags TEXT[],
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Key Database Features

### Row Level Security (RLS)
- **Enabled on all tables** for data protection
- **Policies by role**: Users only access their data unless admin/hub_manager
- **Audit trail**: Role changes and sensitive operations are logged

### Performance Optimizations
- **Indexes**: Created on frequently queried columns (user_id, created_at, status)
- **JSON columns**: Used for flexible data (analytics_summaries.additional_data)
- **UUID keys**: For security and distributed system compatibility

### Data Integrity
- **Foreign key constraints** maintain referential integrity
- **Check constraints** enforce business rules
- **NOT NULL constraints** on critical fields
- **Default values** for common fields (timestamps, status)

## Migration Strategy

### Current Migration Files
Located in `supabase/migrations/` with timestamp-based naming:
- Initial schema setup (Aug 2024)
- User profiles and auth (Aug 2024) 
- Business entities (Aug-Sep 2024)
- RBAC system (Sep 2024)
- Analytics infrastructure (Sep 2024)

### Future Migrations Needed
1. **Subscription tables** (payments, plans, user_subscriptions)
2. **Resource library** (resources, resource_access)
3. **Enhanced cohort management** (additional cohort features)
4. **Impact reporting** (standardized reporting tables)

### Rollback Strategy
- All migrations are reversible
- Database backups before major schema changes
- Supabase provides point-in-time recovery

## Security Considerations

### Data Protection
- **Encrypted at rest** (Supabase managed)
- **Encrypted in transit** (HTTPS/TLS)
- **Row Level Security** prevents unauthorized data access
- **Audit trails** for sensitive operations

### Access Control
- **Role-based permissions** through RLS policies
- **API key management** for external integrations
- **Invite-only registration** during testing phase

## Performance Guidelines

### Query Optimization
```sql
-- Good: Use indexes
SELECT * FROM milestones WHERE user_id = $1 AND status = 'complete';

-- Good: Limit results for large datasets  
SELECT * FROM financial_transactions ORDER BY created_at DESC LIMIT 100;

-- Good: Use appropriate JOIN types
SELECT s.*, m.title FROM strategies s 
LEFT JOIN milestones m ON s.id = m.strategy_id;
```

### Monitoring
- **Query performance** via Supabase dashboard
- **Connection pooling** handled by Supabase
- **Real-time subscriptions** for live data updates

---

*This schema supports the platform's evolution from MVP to full-featured B2C/B2B product while maintaining data integrity and security standards appropriate for African entrepreneurship ecosystem.*