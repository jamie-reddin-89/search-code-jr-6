# Implementation Plan (Admin + App-wide Enhancements)

Owner: Admin (jayjay.r@outlook.com)
Version target after implementation: 1.9.0 (update in Settings > About)

Prerequisites
- Supabase environment is configured (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).
- Confirm RLS policies exist for read access where needed and write access for admin role.
- Recommended: connect Supabase Dashboard to confirm/adjust schemas and RLS.

1) Insert flows for Brand, Model, Category, Tag, Media, URL and app-wide propagation
- Tables used (public): brands, models, categories, tags, media, urls (already in src/integrations/supabase/types.ts).
- Current admin UI: src/pages/AdminAddDevice.tsx already performs inserts into these exact tables.
- Live propagation:
  - Keep using deviceManager.subscribeToDevices() for realtime updates (already implemented for brands and models).
  - Add realtime subscriptions for categories, tags, media, urls if those lists are used elsewhere (same pattern as models/brands):
    - channel names: "categories-changes", "tags-changes", "media-changes", "urls-changes"; on any change, re-query affected UI state.
- Remove hardcoded system names from Admin error-code form:
  - File: src/pages/Admin.tsx — replace systemNames[] and its <SelectContent> with options built from Supabase models/brands, using generateRouteSlug(brand.name, model.name) (src/lib/deviceManager.ts).
  - Display label can be "Brand Name — Model Name" and value a stable key such as model.id or slug; persist to error_codes_db.system_name as slug or store brand_id/model_id if we add columns later.
- Ensure public landing buttons are dynamic:
  - File: src/pages/Index.tsx — replace hardcoded buttonNames[] with a query to brands/models; for each model, render a button to /device/:slug (see section 6).
- Acceptance criteria:
  - Adding any item in AdminAddDevice shows up across the app without refresh (thanks to realtime subscriptions and dynamic lists).
  - Error code form’s system selector lists newly added models immediately.

2) Users list shows all signed-up users
- Problem: src/pages/AdminUsers.tsx -> getAllUsers() reads from user_roles table only, which misses users without a row.
- Solution: add an Edge Function that uses the service role to list Auth users and optionally join profile/roles.
  - Create supabase/functions/admin-users/index.ts with an authenticated admin check (via a header or has_role RPC) and call Supabase Admin API: GET /auth/v1/users.
  - Response: minimal safe user info (id, email, created_at, last_sign_in_at) and join client-side with user_roles and profiles.
- Client changes:
  - File: src/lib/userTracking.ts -> implement getAllUsers() to first call supabase.functions.invoke("admin-users"), fallback to user_roles join if function unavailable.
  - Update AdminUsers.tsx to display the combined list; keep current role management actions.
- Acceptance criteria:
  - All signed up users (even without user_roles or profiles rows) appear.
  - Refresh button reflects new signups.

3) App-wide logging + live update in /admin/app-logs
- DB: public.app_logs (already typed).
- Standardize logging utility:
  - File: src/lib/logger.ts already implements logInfo/logWarn/logError/write/fetch.
  - Wire global handlers:
    - File: src/components/AnalyticsListener.tsx — replace tracking.log usage with logger.logError for window.onerror and unhandledrejection.
- Live updates:
  - File: src/pages/AdminAppLogs.tsx — add a Supabase realtime channel on app_logs; on INSERT append new log to state and update stats. Preserve current search/filter UI.
- Optional: add a global ErrorBoundary component to capture React errors and call logError.
- Acceptance criteria:
  - New logs appear in AdminAppLogs within ~1s, no manual refresh needed.
  - Errors, warnings and info from UI interactions are recorded with user_id and page_path.

4) App-wide analytics collection and Admin analytics page
- DB: public.app_analytics (already typed) plus public.search_analytics (already in use).
- Listener:
  - File: src/components/AnalyticsListener.tsx — switch to use lib/analytics.trackEvent/page_view/click; remove dependency on lib/tracking for persisted analytics.
  - Keep click tracking on elements with .nav-button, button, a, using trackEvent("click", path, meta).
- Search tracking:
  - File: src/hooks/useAnalytics.ts — continue inserting into search_analytics for fast aggregations; also call lib/analytics.trackEvent("search", undefined, { systemName, errorCode }).
- Admin page:
  - File: src/pages/AdminAnalytics.tsx already reads from getAnalyticsStats() in lib/analytics.ts; ensure the new events are flowing.
- Optional: add user_sessions and user_activity wiring on login/logout/page_view to enrich stats (tables exist and are used by AdminUsers’ stats).
- Acceptance criteria:
  - Page views, clicks, error-code views and searches are captured in app_analytics.
  - Admin analytics charts update after interactions.

5) UI review: consistency, themes, and scrollbars
- Unify components by using shared Tailwind classes (.nav-button, .home-button, .page-container) already defined in src/index.css.
- Theme check:
  - src/index.css already defines light and dark CSS variables (light background with dark text; dark background with light text). Confirm components use bg-background/text-foreground.
- Hide scrollbars but allow scrolling (applied carefully):
  - Extend global CSS to hide scrollbars app-wide while preserving scrolling: add selectors for body, .page-container, and scrollable panes using scrollbar-width: none and ::-webkit-scrollbar { width: 0; height: 0 }.
  - Keep focused outlines for accessibility; ensure keyboard scroll still works.
- Acceptance criteria:
  - Visual consistency across pages and dialogs; light/dark contrasts meet expectations; scrollbars visually hidden yet content scrolls.

6) New brand/model automatically creates a button, subpage, and data wiring
- Routing:
  - Add route: /device/:slug in src/App.tsx.
  - Create a new page component DevicePage.tsx that loads by slug via getDeviceBySlug(), shows brand/model info, and lists error codes filtered for that model (initially all error_codes_db; evolve to per-model filtering later — see below).
- Navigation buttons:
  - src/pages/Index.tsx — dynamically list models (brand + model) and link to /device/:slug. Subscribe to models/brands for real-time behavior.
- Error codes per device (evolution):
  - Extend error_codes_db by adding optional brand_id and model_id columns; populate on new entries; DevicePage filters by model_id.
  - Maintain backward compatibility (fallback to system_name/slug).
- Acceptance criteria:
  - Adding a brand + model creates a new button on home and a working subpage with code placeholders for that device.
  - New info appears live without reload.

7) Settings > General: bordered card + Save button, and more settings
- File: src/components/Settings.tsx
  - Wrap General tab content in a bordered, rounded container.
  - Add a Save button that persists the General settings batch (offlineMode, notifications, tooltips, slimLineMode) to localStorage at once; show toast on success.
- Suggest additional General settings:
  - Default landing brand/model (persist slug).
  - Units: Celsius/Fahrenheit; currency for cost estimator; distance units.
  - Language selector.
  - Data saver mode (reduce animations/images on mobile).
  - Confirm-on-delete toggles.
- Acceptance criteria:
  - General tab has a clear card UI with rounded border, a Save action, and persists correctly.

8) Settings > Account: improve layout
- File: src/components/Settings.tsx
  - Arrange fields into clearer sections with headings (Profile, Security, Data), two-column on desktop, single column on mobile.
  - Keep existing actions (Save username, Reset password, Export, Delete) but align with consistent spacing and labels.
- Acceptance criteria:
  - Cleaner visual hierarchy, aligned buttons, and consistent spacing.

9) Settings > About: content changes, contact flow, and Admin Messages page
- File: src/components/Settings.tsx
  - Remove the textual "Contact: {email}" line.
  - Show "Created by: Jamie Reddin, Version: 1.8.5" on a single row; move the Contact button (ContactForm) into the top row actions area next to the title.
- Email sending is already implemented by ContactForm via Edge Function contact-send (supabase/functions/contact-send/index.ts).
- Store sent messages and show in Admin > Messages:
  - Table: public.contact_messages (if missing, create) with columns: id uuid default uuid_generate_v4(), name text, email text, subject text, message text, created_at timestamptz default now().
  - Edge function already writes to contact_messages if SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL env vars are configured.
  - Create new page src/pages/AdminMessages.tsx that lists contact_messages with filters and details; add route /admin/messages in src/App.tsx and add a nav button in src/pages/Admin.tsx.
- Acceptance criteria:
  - About tab shows single-row Created by + Version and Contact button at top.
  - Messages admin page displays submissions as they come in (enable realtime on contact_messages).

SQL (DDL) for new/updated tables (run in Supabase SQL editor)
- contact_messages
  CREATE TABLE IF NOT EXISTS public.contact_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );

- error_codes_db optional columns to support per-model scoping (backward compatible)
  ALTER TABLE public.error_codes_db ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id);
  ALTER TABLE public.error_codes_db ADD COLUMN IF NOT EXISTS model_id uuid REFERENCES public.models(id);
  CREATE INDEX IF NOT EXISTS idx_error_codes_model_id ON public.error_codes_db(model_id);

RLS policy suggestions (adjust as needed)
- contact_messages
  - Enable RLS.
  - Allow INSERT for authenticated (contact form uses Edge Function with service role; client-side shouldn’t write directly).
  - Allow SELECT to role admin only (via has_role('admin', auth.uid()) or restricting via user_roles table).

- app_logs, app_analytics
  - Enable RLS.
  - INSERT for authenticated users; SELECT for admin only.

10) New features and optimizations
- Performance
  - Code-split charts (AdminAnalytics) and large pages.
  - Cache brand/model lists with SWR-like strategy; add optimistic UI on AdminAddDevice saves.
- Reliability
  - Add React ErrorBoundary logging to app_logs.
  - Retry with exponential backoff for logging/analytics writes.
- Offline/PWA
  - Add service worker for caching error codes and static assets; background sync for analytics.
- Search UX
  - Fuzzy search across error_codes_db.meaning/solution; highlight matches.
  - Batch import/export for error codes via CSV.
- RBAC
  - Granular roles (moderator can add codes but not delete; admin full access).
- Observability
  - Add session correlation id to logs/analytics; include device info in analytics meta.

Versioning
- After implementing, update the version text in src/components/Settings.tsx About tab from 1.8.5 to 1.9.0.

Routing/File changes checklist
- src/pages/Index.tsx: dynamic model buttons using Supabase; remove hardcoded list.
- src/App.tsx: add route /device/:slug; add /admin/messages.
- src/pages/Admin.tsx: add Messages nav button; replace systemNames select with dynamic options.
- src/pages/AdminAppLogs.tsx: add realtime subscription to app_logs.
- src/components/AnalyticsListener.tsx: switch to lib/analytics + logger; add global error tracking via logError.
- src/hooks/useAnalytics.ts: also call lib/analytics.trackEvent.
- src/components/Settings.tsx: General tab card + Save; Account layout; About tab changes.
- New: src/pages/AdminMessages.tsx (list contact_messages with filters + realtime).

Security notes
- Do not use service role on the client. Use Edge Functions for privileged operations (auth users listing, emailing).
- Validate user role server-side inside Edge Functions.

MCP/integrations recommendations (optional but helpful)
- Supabase: database/auth, realtime, storage. Connect for schema and RLS management.
- Sentry: production error monitoring in addition to app_logs.
- Netlify: deploy previews and CI/CD for the app.
- Zapier: pipe contact_messages into Slack/Email if desired.
- Notion/Linear: track roadmap and issues.
- Stripe: monetize premium features (managed via webhooks + Edge Functions).
- Prisma Postgres/Neon: alternative DB/ORM workflows if needed.
- Builder CMS: manage content for marketing pages and docs.
- Context7: in-app docs for referenced libs.
- Figma plugin (Builder.io): streamline UI iterations from design files.

Acceptance summary
- Admin insertions reflect app-wide in real time.
- Users page shows all authenticated users.
- Logs and analytics are captured across the app and update admin pages live.
- UI/theme consistent; scrollbars hidden; accessibility preserved.
- Settings tabs improved; About updated; Messages page shows contact submissions.
- Version bumped to 1.9.0 post-implementation.
