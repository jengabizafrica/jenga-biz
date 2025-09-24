# Project Structure

This document outlines the folder structure, file organization patterns, and architectural decisions for the Jenga Biz Africa platform.

## Root Directory Structure

```
jenga-biz/
├── src/                          # Source code (React + TypeScript)
├── supabase/                     # Supabase configuration and migrations
├── Docs/                         # Project documentation
├── public/                       # Static assets
├── dist/                         # Production build output (generated)
├── node_modules/                 # Dependencies (generated)
├── .env                          # Environment variables (local)
├── package.json                  # Project dependencies and scripts
├── vite.config.ts               # Vite build configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── eslint.config.js            # ESLint configuration
└── WARP.md                      # Warp AI guidance documentation
```

## Source Code Organization (`src/`)

### Application Entry Points
```
src/
├── main.tsx                     # Application entry point
├── App.tsx                      # Main app component with routing and providers
├── index.css                    # Global styles and CSS variables
└── vite-env.d.ts               # Vite type definitions
```

### Component Architecture
```
src/components/
├── ui/                          # shadcn/ui primitive components
│   ├── button.tsx              # Button component
│   ├── card.tsx                # Card component
│   ├── dialog.tsx              # Modal/Dialog component
│   ├── form.tsx                # Form components
│   ├── table.tsx               # Table components
│   └── [other-ui-components]   # Additional UI primitives
├── auth/                        # Authentication components
│   ├── AuthDialog.tsx          # Login/signup modal
│   ├── EnhancedAuthDialog.tsx  # Advanced auth with invite codes
│   └── InviteCodeManager.tsx   # Admin invite code management
├── dashboard/                   # Dashboard components
│   ├── AdminDashboard.tsx      # Admin/ecosystem builder dashboard
│   └── UserManagement.tsx      # User role management interface
├── analytics/                  # Analytics and reporting components
│   ├── AnalyticsDashboard.tsx  # Main analytics dashboard
│   ├── BusinessIntelligenceDashboard.tsx # BI dashboard
│   ├── FinancialInsightsDashboard.tsx    # Financial analytics
│   ├── ImpactMeasurementDashboard.tsx    # Impact reporting
│   └── [other-analytics]       # Additional analytics components
└── [business-components]/       # Business logic components
    ├── UserDashboard.tsx       # Main user dashboard
    ├── BusinessMilestonesSection.tsx # Milestone tracking
    ├── MonthlyRevenueSection.tsx     # Financial tracker
    ├── StrategyBuilder.tsx     # Business strategy builder
    └── [other-business-components]   # Additional business components
```

### Pages and Routing
```
src/pages/
├── Index.tsx                    # Landing page
├── Auth.tsx                     # Authentication page
├── Home.tsx                     # Home page
├── Templates.tsx                # Business templates page
├── Strategy.tsx                 # Strategy building page
├── Profile.tsx                  # User profile management
├── PasswordReset.tsx           # Password reset page
└── NotFound.tsx                # 404 error page
```

### Business Logic and State Management
```
src/hooks/
├── useAuth.tsx                  # Authentication state management
├── useStrategy.tsx             # Business strategy operations
├── useAnalytics.tsx            # Analytics data fetching
├── useBusinessIntelligence.tsx # BI data operations
├── useFinancialInsights.tsx    # Financial analytics
├── useImpactMeasurement.tsx    # Impact tracking
├── use-mobile.tsx              # Mobile detection hook
└── use-toast.ts                # Toast notifications
```

### Utility Functions and Services
```
src/lib/
├── utils.ts                     # General utility functions
├── shareUtils.ts               # Sharing functionality
├── profile.ts                  # Profile management utilities
├── milestones.ts               # Milestone operations
└── calendar.ts                 # Calendar utilities
```

### Data Integration Layer
```
src/integrations/
└── supabase/
    ├── client.ts               # Supabase client configuration
    └── types.ts                # Generated TypeScript types from database
```

### Static Data
```
src/data/
├── templateData.ts             # Business template definitions
└── africanCountries.ts         # African country/currency data
```

## Supabase Backend Structure

### Database Migrations
```
supabase/migrations/
├── 20250827112841_*.sql        # Initial schema setup
├── 20250827112859_*.sql        # User profiles and authentication
├── 20250829081628_*.sql        # Business entities and relationships
├── 20250830060635_*.sql        # Role-based access control
├── 20250831071518_*.sql        # Analytics and reporting tables
├── 20250903121035_*.sql        # Cohort management infrastructure
└── [timestamp]_[description].sql # Additional migrations
```

### Edge Functions
```
supabase/functions/
├── send-password-reset/
│   └── index.ts                # Password reset email service
└── send-signup-confirmation/
    └── index.ts                # Signup confirmation email service
```

### Configuration
```
supabase/
└── config.toml                 # Supabase project configuration
```

## Documentation Structure

```
Docs/
├── PRD.md                      # Product Requirements Document
├── Stories.md                  # Detailed feature stories
├── Implementation.md           # Implementation analysis and gaps
├── project_structure.md       # This file - project organization
├── UI_UX_doc.md               # UI/UX specifications (to be created)
├── database_schema.md          # Database design documentation (to be created)
└── [additional-docs]/          # Future documentation files
```

## Configuration Files

### Build and Development
- `vite.config.ts` - Vite configuration with React SWC, path aliases, and development server settings
- `tsconfig.json` - TypeScript project references and path mapping
- `tsconfig.app.json` - Application TypeScript configuration with bundler resolution
- `tsconfig.node.json` - Node.js specific TypeScript configuration

### Code Quality
- `eslint.config.js` - ESLint configuration with TypeScript and React rules
- `prettier.*` - Code formatting rules (if present)

### Styling
- `tailwind.config.ts` - Tailwind CSS configuration with design tokens
- `postcss.config.js` - PostCSS configuration for Tailwind processing
- `src/index.css` - Global CSS with design system variables

## Module Organization Patterns

### Import Alias Strategy
- `@/*` resolves to `./src/*` for clean internal imports
- Example: `import { Button } from '@/components/ui/button'`

### Component Naming Conventions
- **UI Components**: PascalCase with descriptive names (`BusinessMilestonesSection.tsx`)
- **Pages**: PascalCase, typically single words (`Auth.tsx`, `Profile.tsx`)
- **Hooks**: camelCase with 'use' prefix (`useAuth.tsx`, `useStrategy.tsx`)
- **Utils**: camelCase (`shareUtils.ts`, `profile.ts`)

### File Structure Principles
1. **Separation of Concerns**: Business logic (hooks) separate from UI (components)
2. **Feature Grouping**: Related components grouped by domain (analytics/, auth/, dashboard/)
3. **Reusability**: UI primitives in dedicated ui/ folder
4. **Single Responsibility**: Each file has a clear, specific purpose

## Environment Configuration

### Environment Variables Structure
```
.env (local development)
├── SUPABASE_URL                # Supabase project URL
├── SUPABASE_ANON_KEY          # Supabase anonymous key
├── VITE_SUPABASE_URL          # Client-side Supabase URL
├── VITE_SUPABASE_ANON_KEY     # Client-side Supabase key
└── [other-env-vars]           # Additional configuration
```

### Deployment Structure (Vercel)
```
Production Deployment:
├── Domain: https://jengabiz.africa
├── Project: jenga-biz
├── Build Command: npm run build
├── Output Directory: dist/
└── Environment Variables: Set in Vercel dashboard
```

## Asset Organization

### Public Assets
```
public/
├── jenga-biz-logo.png          # Application logo
├── favicon.ico                 # Browser favicon
└── [other-static-assets]       # Images, icons, etc.
```

### Dynamic Assets
- Images processed through Vite asset pipeline
- Icons from Lucide React icon library
- Fonts loaded via CSS (system fonts + web fonts)

## Development Workflow Structure

### Scripts (package.json)
- `npm run dev` - Development server (Vite on port 8080)
- `npm run build` - Production build
- `npm run build:dev` - Development build
- `npm run lint` - ESLint code checking
- `npm run preview` - Preview production build locally

### Code Organization Best Practices
1. **Consistent Import Order**: External deps → Internal deps → Relative imports
2. **Type Definitions**: Co-located with components or in dedicated .d.ts files
3. **Error Boundaries**: Implemented at appropriate component tree levels
4. **Loading States**: Handled consistently across async operations

## Integration Points

### External Services
- **Supabase**: Database, auth, real-time subscriptions
- **Resend**: Email services (password reset, confirmations)
- **Vercel**: Hosting and deployment
- **Future**: Paystack (payments), Context7 (documentation), Semgrep (security)

### Data Flow Architecture
```
User Interface (React Components)
        ↓
Custom Hooks (Business Logic)
        ↓
Supabase Client (Data Layer)
        ↓
PostgreSQL Database (Supabase)
```

This structure supports the platform's dual nature as both a B2C entrepreneur tool and a B2B ecosystem builder platform, with clear separation between user-facing features and administrative/analytics capabilities.