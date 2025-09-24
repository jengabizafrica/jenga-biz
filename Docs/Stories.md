# Detailed Feature Breakdown: Jenga Biz Africa PRD

---

## Epic 1: Entrepreneur Workspace (B2C)

**Goal:** To provide a single, intuitive platform for entrepreneurs to manage and grow their businesses.

### Feature 1.1: Guided Business Roadmap

**Description:**  
Interactive, step-by-step pathways tailored to different business stages (e.g., Idea, Validation, Growth) with actionable tips and resources.

**User Stories:**  
- **As an Entrepreneur,** I want to select my business stage during onboarding so that I can see a relevant, customized roadmap.  
- **As an Entrepreneur,** I want to mark roadmap steps as complete so that I can track my progress visually.  
- **As an Entrepreneur,** I want to access "pro tips" and linked resources for each step so that I can learn how to execute specific tasks effectively.

**Acceptance Criteria (AC):**  
- AC1: User must be able to choose from at least 3 predefined business stages.  
- AC2: The roadmap UI must visually distinguish between completed, in-progress, and not-started steps.  
- AC3: Each step must have a title, a short description, and a link to at least one resource (article, template, video).

---

### Feature 1.2: Milestones & OKR Tracker

**Description:**  
A tool for setting, tracking, and managing business goals and key milestones with deadlines and notifications.

**User Stories:**  
- **As an Entrepreneur,** I want to create a milestone (e.g., "Launch new product line") with a title, description, and deadline.  
- **As an Entrepreneur,** I want to break down a milestone into smaller, actionable tasks.  
- **As an Entrepreneur,** I want to receive browser or email reminders for upcoming and overdue milestones.  
- **As an Entrepreneur,** I want to log the number of jobs created when a milestone is achieved.

**Acceptance Criteria (AC):**  
- AC1: The system must allow users to create, edit, and delete milestones.  
- AC2: The dashboard must display a calendar view or a list view of upcoming milestones.  
- AC3: A notification must be sent 48 hours before a milestone deadline.  
- AC4: A mandatory field for "Jobs Created" must appear upon marking a milestone as complete.

---

### Feature 1.3: Simple Financial Tracker

**Description:**  
A simplified interface for recording daily revenue and expenses, with basic categorization and reporting.

**User Stories:**  
- **As an Entrepreneur,** I want to quickly log a transaction (income or expense) with amount, date, category, and notes.  
- **As an Entrepreneur,** I want to view a summary of my finances (total revenue, total expenses, net profit) for a selected period (week, month, quarter).  
- **As an Entrepreneur,** I want to generate a simple PDF or Excel report of my transactions to share with my accountant or a loan officer.  
- **As an Entrepreneur,** I want to select my local currency (e.g., KES, NGN, GHS) for all financial tracking.

**Acceptance Criteria (AC):**  
- AC1: The transaction form must include validation to prevent future-dated entries and negative amounts.  
- AC2: The financial summary must calculate totals correctly based on the selected date range.  
- AC3: The exported report must include all transaction details and the summary totals.

---

## Epic 2: Ecosystem Builder Dashboard (B2B)

**Goal:** To provide ecosystem enablers with real-time data and insights to manage programs and demonstrate impact.

### Feature 2.1: Cohort Management Portal

**Description:**  
A central hub for Ecosystem Builders to view and manage all entrepreneurs enrolled in their programs.

**User Stories:**  
- **As an Ecosystem Builder,** I want to create a new cohort for a specific program (e.g., "Q3 2024 AgriTech Accelerator").  
- **As an Ecosystem Builder,** I want to invite entrepreneurs to join a cohort via a shareable link or email.  
- **As an Ecosystem Builder,** I want to see a list of all entrepreneurs in a cohort, along with their business name, stage, and last activity date.

**Acceptance Criteria (AC):**  
- AC1: User must be able to create a cohort with a name, description, and start/end dates.  
- AC2: The system must generate a unique, secure invitation link for each cohort.  
- AC3: The cohort list must be sortable and filterable by business stage and activity status.

---

### Feature 2.2: Analytics & Engagement Insights Dashboard

**Description:**  
A dashboard with visual charts and graphs displaying aggregated, anonymized data on cohort performance and engagement.

**User Stories:**  
- **As an Ecosystem Builder,** I want to see the completion rates of key roadmap milestones across my entire cohort.  
- **As an Ecosystem Builder,** I want to identify common drop-off points in the roadmap to understand where entrepreneurs struggle.  
- **As an Ecosystem Builder,** I want to see which resources and templates are most used by my entrepreneurs.

**Acceptance Criteria (AC):**  
- AC1: All data must be aggregated and anonymized; no individual entrepreneur's data should be visible without explicit permission.  
- AC2: Charts (e.g., bar charts, line graphs) must be used to visualize completion rates and engagement metrics.  
- AC3: The dashboard must update in near real-time as entrepreneurs use the platform.

---

### Feature 2.3: Impact Measurement & Reporting

**Description:**  
Automated tools to measure and report on key impact metrics like job creation, business survival, and funding readiness.

**User Stories:**  
- **As an Ecosystem Builder,** I want to see the total number of jobs created by all businesses in my cohort.  
- **As an Ecosystem Builder,** I want to filter my cohort data by demographics, region, or business stage.  
- **As an Ecosystem Builder,** I want to generate a standardized impact report (PDF/Excel) for my donors, with data from a specific date range.

**Acceptance Criteria (AC):**  
- AC1: The job creation metric must be pulled directly from the milestones completed by entrepreneurs.  
- AC2: The report generator must allow filtering by at least three criteria (e.g., region, stage, gender of founder).  
- AC3: The exported report must include a timestamp and the name of the ecosystem organization.

---

## Epic 3: Platform Foundations

**Goal:** To ensure the platform is secure, scalable, and delivers a high-quality user experience.

### Feature 3.1: Multi-Language & Multi-Currency Support

**Description:**  
The platform must be accessible and relevant across Africa's diverse linguistic and economic landscape.

**User Stories:**  
- **As an Entrepreneur in Kenya,** I want to use the platform in Swahili.  
- **As an Entrepreneur in Nigeria,** I want to track my finances in Nigerian Naira (NGN).

**Acceptance Criteria (AC):**  
- AC1: The UI must support at a minimum English, French, and Swahili.  
- AC2: Currency conversion rates must be updated daily via a secure API.

---

### Feature 3.2: Role-Based Access Control (RBAC) & Security

**Description:**  
A robust system to manage user permissions and protect sensitive business data.

**User Stories:**  
- **As a System Admin,** I want to assign roles (Admin, Ecosystem Builder, Entrepreneur) to users.  
- **As an Entrepreneur,** I want to be assured that my financial data is only visible to me and not to my Ecosystem Builder without my consent.

**Acceptance Criteria (AC):**  
- AC1: Entrepreneurs must explicitly opt-in to share specific data points with their Ecosystem Builder.  
- AC2: All passwords must be hashed. All data transmission must use HTTPS (SSL/TLS).

---

*This detailed feature breakdown provides actionable requirements for development teams to build, test, and ensure alignment with the platform’s strategic vision.*
