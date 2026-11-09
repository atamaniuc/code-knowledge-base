# Backend Developer: PHP + Laravel

Role:  Backend Developer: PHP + Laravel
                                  Location  : Remote -  2-4 hrs overlap with CT
                                  Engagement  : Long-term contract / full-time contractor
                                  About the client
                                  The client is a cloud field service management platform for trade companies (HVAC, plumbing,
                                  electrical). Thousands of companies use it to schedule jobs, send estimates and invoices, take
                                  payments and sync to their accounting tools. It is multi-tenant: one shared database, every row
                                  belongs to a company, and the app code keeps tenants apart.
                                  The stack
                                          -       Main API | Laravel 11, PHP 8.2+, mid-migration from Laravel 7, a Laravel 12 line in
                                                  progress
                                          -       Admin portal - Laravel with Blade views
                                          -       Database : PostgreSQL (AWS Aurora), about 550 Eloquent models, about 1000
                                                  migrations
                                          -        Code layout: About 90 self-contained modules (`app/Modules/<Name>/`: models,
                                                  services, routes, tests)
                                          -        Auth: Laravel Passport (OAuth2), JWT, 2FA
                                          -       Queues and cache: AWS SQS, Redis
                                          -       Tests : PHPUnit 11, PHP-CS-Fixer (PSR-12)
                                          -       Infra: Docker, AWS EKS (Kubernetes), Helm, GitHub Actions, Sentry
                                          -       Frontend (not the main focus): Angular 16, TypeScript
                                          -       Tracking: Linear, GitHub PRs with required review
                                  What the tasks look like
                                  Real examples of the work, roughly in order of how often they come up.
                                  1. Bug fixes from QA and support.  A customer sees a wrong total, a missing button, a page that
                                      500s. Reproduce it, find the cause in code and data, fix it with a regression test, hand it
                                      to QA with clear steps.
                                  2. Third-party integrations.Building and fixing sync with outside systems: reading webhook
                                      payloads, calling REST APIs, handling retries, races and partial failures, and keeping our
                                      data in sync with theirs. Current integrations: Nue, Salesforce, Stripe, Payrix, Square,
                                      QuickBooks Online, QuickBooks Desktop, Xero, Zapier, Google, CompanyCam, Wisetack,
                                  Reece,Granite, TSheets, Pusher, SendGrid, ZipTax.
                                  3. Features end to end on the API. New endpoints, validation, permissions, a migration,
                                      a queued job, and tests. Sometimes a small Angular changes to show it.
                                  4. Billing and seat logic. Subscriptions, seat limits, add-on toggles, invoice history,
                                      payment-issue states. Money math has to be exact.
                                  5. Artisan commands for data repair and backfills. Always with a dry-run mode. Proven locally,
                                      then on the dev server, then handed to the person who runs production.
                                  6. Production investigation (read-only). Query a read-only production replica to size a
                                      problem: how many companies are affected, since when, why.
        7. Legacy modernization. Bring old Laravel 7 code forward when touching it. Port changes to
         the Laravel 12 branch.
        8. Code review. Review teammates' PRs for tenant safety, correctness and safe migrations.
        Must have
        - 6+ years of production PHP and Laravel. Comfortable with Eloquent (scopes, relations,
         eager loading), queues and jobs, migrations, form requests, middleware, service container.
        - Modern PHP 8.2+. Enums, readonly classes, typed properties, `match`.
        - Strong SQL and PostgreSQL. Read a query plan, spot a missing index or an N+1, write a safe
         migration on big tables.
        - Writes tests by default. PHPUnit feature and unit tests. A bug fix comes with a test that
         fails before the fix.
        - Multi-tenant thinking. Every query scoped to the company. Sees a cross-tenant leak in review.
        - REST APIs and webhooks. Has built and maintained several third-party integrations.
         Understands OAuth, idempotency, retries and race conditions.
        - Debugs from evidence. Reproduces before concluding. Reads logs, data and code, not
        guesses.
        - Git and PR workflow. Small focused PRs, clear descriptions, rebasing across several
         long-lived branches without losing work.
        - Clear written English. Most communication is async: Linear tickets, PR comments, Slack.
         Short, plain updates with steps QA can follow.
        Nice to have
        - Laravel version upgrades (7 to 11 or 11 to 12) on a large codebase.
        - Hands-on with any of our integrations: Nue, Salesforce, Stripe, Payrix, Square, QuickBooks
         Online, QuickBooks Desktop, Xero, Zapier, Google, CompanyCam, Wisetack, Reece, Granite,
        TSheets.
        - Subscription billing: plans, seats, proration, invoices.
        - AWS: SQS, S3, Aurora, EKS. Docker and Kubernetes basics. GitHub Actions.
        - Angular or TypeScript, enough to make small frontend changes.
        - Field service, SaaS or B2B background.
        - Using AI coding tools (Claude Code or similar) in a disciplined way: verifies output, does not
         ship what it has not run.
        - Sentry or similar monitoring.
        What makes someone a good fit
        - Owns a ticket end to end. From reading the report to verifying on the dev server to the
         QA handoff, without being pushed at each step.
        - Careful with production. Prefers additive migrations, dry runs and read-only checks. Knows
         that real customers pay through this system.
        - Comfortable in legacy code. The codebase is large and mid-migration. They improve what
        they touch and do not rewrite what they do not.
        - Asks when unsure, then writes it down. Tribal knowledge is captured in docs so the next
         person does not rediscover it.
        - Overlap with US Central time for a few hours a day. Releases have a 4:30 PM Central cutoff.
