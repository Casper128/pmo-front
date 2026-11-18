# Graph Report - pmo-front  (2026-11-17)

## Corpus Check
- 147 files · ~55,253 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .css 8, .toml 2)

## Summary
- 1352 nodes · 3045 edges · 87 communities (33 shown, 54 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 100 edges (avg confidence: 0.84)
- Token cost: 109,321 input · 0 output

## Community Hubs (Navigation)
- App Config & Audit Gateways
- Management Template Gateway
- App Parameters Facade
- Config Admin Edge Function
- Angular Build Config
- Analytics Charts (Chart.js)
- Consultant Locations
- Auth Gateway & Session
- Management Report Detail
- Multiple Import Page Core
- Delete Requests Gateway
- UI Select Component
- Consultant Statistics Page
- UI Date Input
- UI Time Input
- Template Required Fields
- Time Record Domain Service
- Time Record Validation & Preview
- Routing & Environment
- Edit Record Modal
- Send Log Gateway
- Package Metadata
- Shared Pipes & Directives
- Time Records Templates
- Time Record Model & Alerts
- App Shell Component
- Time Record Registration Flow
- Workday Hours Policy
- Clean Architecture Docs
- Time Management Gateway
- UI Field Component
- Management Template Form
- Overflow Tooltip Directive
- Runtime Dependencies
- Time Record API Body Builder
- UI Modal Component
- Send Logs Page
- Dev Dependencies
- Time Management HTTP Adapter
- UI Field & Form Section Types
- UI Search Input
- UI Toolbar Component
- Architecture Check Script
- Import Text Input
- Weekly Hours Chart
- Icons & App Host
- Send All Records Results
- npm Scripts
- Daily Hours Limit Policy
- UI Segmented Control
- Management Delete Edge Function
- Technical Delete Edge Function
- Management Edit Edge Function
- User Directory & Login Audit SQL
- Send Logs SQL
- Report Location Verification SQL
- Delete Requests SQL
- PMO Parameters SQL
- Text Import Format Docs
- Report Detail Presenter
- User Parameters SQL
- Latest Consultant Location SQL
- Production Environment
- Delete Approve/Reject Workflow
- Management Templates SQL
- Field Options & RLS Docs
- Load Select Options Use Case
- Consultant Locations Template
- App Settings Docs

## God Nodes (most connected - your core abstractions)
1. `MultipleImportPageComponent` - 132 edges
2. `ManagementReport` - 72 edges
3. `TimeRecord` - 53 edges
4. `@angular/core` - 45 edges
5. `ConsultantStatisticsPageComponent` - 45 edges
6. `ManagementAdvancedTemplate` - 43 edges
7. `TimeRecordDomainService` - 40 edges
8. `UiSelectComponent` - 39 edges
9. `AuthGateway` - 37 edges
10. `UiDateInputComponent` - 33 edges

## Surprising Connections (you probably didn't know these)
- `Legacy DDD feature-sliced structure (src/app/features)` --semantically_similar_to--> `Clean Architecture (layer-first)`  [INFERRED] [semantically similar]
  README.md → ARCHITECTURE.md
- `TIME_RECORDS_PROVIDERS` --semantically_similar_to--> `Composition root (app.config.ts + shell/providers)`  [INFERRED] [semantically similar]
  README.md → ARCHITECTURE.md
- `Supabase Edge Functions (pmo-config-admin, pmo-user-audit, pmo-management-*, pmo-location-admin, pmo-send-logs)` --conceptually_related_to--> `AuthService (JWT token centralizado)`  [INFERRED]
  SUPABASE_SETUP.md → README.md
- `Management Report Detail Modal Template` --semantically_similar_to--> `Edit Record Modal Template`  [INFERRED] [semantically similar]
  src/presentation/time-records/components/management-report-detail-modal/management-report-detail-modal.component.html → src/presentation/time-records/components/edit-record-modal/edit-record-modal.component.html
- `Weekly Hours Chart Template` --semantically_similar_to--> `Statistics Chart Template`  [INFERRED] [semantically similar]
  src/presentation/time-records/components/weekly-hours-chart/weekly-hours-chart.component.html → src/presentation/time-records/components/statistics-chart/statistics-chart.component.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Time record registration flow** — architecture_sendallrecordsusecase, architecture_registertimerecordusecase, architecture_locationgateway, architecture_timerecordrepository, architecture_userauditgateway [EXTRACTED 1.00]
- **Shared UI form controls with label/error/hint contract** — src_presentation_shared_components_ui_field_ui_field_component, src_presentation_shared_components_ui_select_ui_select_component, src_presentation_shared_components_ui_date_input_ui_date_input_component, src_presentation_shared_components_ui_time_input_ui_time_input_component, src_presentation_shared_components_ui_search_input_ui_search_input_component [INFERRED 0.85]
- **Supabase security model (RLS read-only, Edge Functions, secrets)** — supabase_setup_rls_readonly, supabase_setup_edge_functions, supabase_setup_publishable_key_only, supabase_setup_admin_emails [INFERRED 0.85]
- **Multiple Import Draft Flow** — src_presentation_time_records_pages_multiple_import_page_component_template, src_presentation_time_records_components_import_text_input_import_text_input_component_template, src_presentation_time_records_components_records_preview_records_preview_component_template, src_presentation_time_records_components_edit_record_modal_edit_record_modal_component_template, src_presentation_time_records_components_management_template_dialog_management_template_dialog_component_template [INFERRED 0.85]
- **Period-filtered Reporting Pages** — src_presentation_time_records_pages_send_logs_page_component_template, src_presentation_time_records_pages_consultant_statistics_page_component_template, src_presentation_time_records_pages_multiple_import_page_component_template, src_presentation_time_records_pages_send_logs_page_component_period_preset_filter [INFERRED 0.75]

## Communities (87 total, 54 thin omitted)

### Community 0 - "App Config & Audit Gateways"
Cohesion: 0.06
Nodes (23): @angular/platform-browser, rxjs, LocationGateway, ReportAuditContext, UserAuditGateway, LoadSelectOptionsUseCase, RegisterTimeRecordUseCase, SendAllRecordsUseCase (+15 more)

### Community 1 - "Management Template Gateway"
Cohesion: 0.06
Nodes (9): ManagementTemplateGateway, ManagementAdvancedTemplate, ManagementDemandOption, ManagementTemplateAdapter, ManagementTemplateMapper, TemplatePayload, CollectionResponse, ManagementTemplateDialogComponent (+1 more)

### Community 2 - "App Parameters Facade"
Cohesion: 0.06
Nodes (16): AppParametersFacade, AdvancedFieldConfiguration, AdvancedFieldKey, DeletionSettings, ParameterOption, WorkSettings, AppParametersService, ConfigurationPayload (+8 more)

### Community 3 - "Config Admin Edge Function"
Cohesion: 0.06
Nodes (23): corsHeaders, defaultDailyHours, findValue(), sanitizeWorkSettings(), validHours(), corsHeaders, findValue(), asRecord() (+15 more)

### Community 4 - "Angular Build Config"
Cohesion: 0.05
Nodes (40): build, serve, test, builder, configurations, defaultConfiguration, options, cli (+32 more)

### Community 5 - "Analytics Charts (Chart.js)"
Cohesion: 0.10
Nodes (8): chart.js, AnalyticsAccent, AnalyticsChartCardComponent, StatisticsChartComponent, StatisticsChartConfigFactory, StatisticsChartConfigInput, StatisticsChartTheme, StatisticsChartItem

### Community 6 - "Consultant Locations"
Cohesion: 0.11
Nodes (9): ConsultantLocationGateway, ConsultantLocation, ConsultantLocationCollection, ConsultantLocationEvent, ConsultantLocationFilter, LocationVerificationStatus, LocationApiResponse, SupabaseConsultantLocationAdapter (+1 more)

### Community 7 - "Auth Gateway & Session"
Cohesion: 0.11
Nodes (3): AuthGateway, AuthUser, AuthService

### Community 8 - "Management Report Detail"
Cohesion: 0.14
Nodes (3): ManagementReport, ManagementReportDetailModalComponent, ManagementReportDetailPresenter

### Community 10 - "Delete Requests Gateway"
Cohesion: 0.12
Nodes (6): ManagementDeleteRequestGateway, ManagementDeleteRequest, ManagementDeleteRequestStatus, DeleteRequestRow, ManagementDeleteRequestAdapter, AuditDeleteRequestsPageComponent

### Community 15 - "Template Required Fields"
Cohesion: 0.11
Nodes (17): ADVANCED_TEMPLATE_FIELDS, isMissingAdvancedTemplateValue(), REQUIRED_ADVANCED_TEMPLATE_FIELDS, UiModalSize, UiModalVariant, StateTone, UiStateMessageComponent, DailyHours (+9 more)

### Community 18 - "Routing & Environment"
Cohesion: 0.18
Nodes (9): @angular/common, @angular/router, environment, UiMetricCardComponent, UiMetricTone, UiPageHeaderComponent, UiSelectOption, locationAdminGuard() (+1 more)

### Community 20 - "Send Log Gateway"
Cohesion: 0.20
Nodes (8): SendLogGateway, CreateSendLog, SendLog, SendLogCollection, SendLogQuery, SendLogResponse, SendLogRow, SupabaseSendLogAdapter

### Community 21 - "Package Metadata"
Cohesion: 0.10
Nodes (19): name, packageManager, private, version, @angular/build, @angular/cli, @angular/compiler, @angular/compiler-cli (+11 more)

### Community 22 - "Shared Pipes & Directives"
Cohesion: 0.23
Nodes (7): @angular/core, @angular/forms, CalendarDay, UiSegmentedOption, LogPeriod, LogPeriodPreset, FechaEspPipe

### Community 24 - "Time Records Templates"
Cohesion: 0.16
Nodes (19): Analytics Chart Card Template, Edit Record Modal Template, Import Text Input Template, Management Report Detail Modal Template, Management Template Dialog Template, Management Template Required Fields, Management Template Form Template, Records Preview Template (+11 more)

### Community 25 - "Time Record Model & Alerts"
Cohesion: 0.23
Nodes (12): AdvancedTemplateValues, DailyHoursLimitViolation, DayGroup, HorasAlert, RecordHoursLimitViolation, REQUIRED_FIELDS, TIME_RECORD_DEFAULTS, TimeRecordApiBuildInput (+4 more)

### Community 27 - "Time Record Registration Flow"
Cohesion: 0.12
Nodes (17): LocationGateway, RegisterTimeRecordUseCase, SendAllRecordsUseCase, Flujo de registro de tiempos, TimeRecordRepository, UserAuditGateway, AuthService (JWT token centralizado), MultipleImportPageComponent (+9 more)

### Community 30 - "Clean Architecture Docs"
Cohesion: 0.13
Nodes (11): Arquitectura de PMO Front, application layer, npm run check:architecture, domain layer, infrastructure layer, npm run verify, Path aliases @domain/@application/@infrastructure/@presentation/@env, presentation layer (+3 more)

### Community 31 - "Time Management Gateway"
Cohesion: 0.23
Nodes (5): DeleteRequestBody, TechnicalDeleteBody, TimeManagementGateway, ReportDownloadFilter, ReportDownloadResponse

### Community 35 - "Runtime Dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/platform-browser, @angular/router, chart.js (+6 more)

### Community 40 - "Dev Dependencies"
Cohesion: 0.17
Nodes (12): devDependencies, @angular/build, @angular/cli, @angular/compiler-cli, jsdom, postcss, prettier, tailwindcss (+4 more)

### Community 42 - "UI Field & Form Section Types"
Cohesion: 0.18
Nodes (6): UiFieldTone, UiFieldType, UiFieldValueType, UiFormSectionColumns, UiFormSectionComponent, UiFormSectionDensity

### Community 47 - "Architecture Check Script"
Cohesion: 0.20
Nodes (5): files(), requiredLayers, sourceRoot, violations, workspace

### Community 50 - "Icons & App Host"
Cohesion: 0.28
Nodes (7): @ng-icons/core, @ng-icons/lucide, index.html (app-root host), UiToolbarTheme, AppTheme, NavItem, NavSection

### Community 53 - "npm Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, check:architecture, ng, start, test, verify, watch

### Community 56 - "Management Delete Edge Function"
Cohesion: 0.38
Nodes (4): asRecord(), corsHeaders, extractRows(), findValue()

### Community 57 - "Technical Delete Edge Function"
Cohesion: 0.33
Nodes (3): asRecord(), corsHeaders, findValue()

### Community 58 - "Management Edit Edge Function"
Cohesion: 0.38
Nodes (5): allowedFields, asRecord(), corsHeaders, extractRows(), findValue()

### Community 60 - "User Directory & Login Audit SQL"
Cohesion: 0.53
Nodes (4): pmo_login_events_user_time_idx, pmo_user_directory_email_idx, public.pmo_login_events, public.pmo_user_directory

### Community 61 - "Send Logs SQL"
Cohesion: 0.53
Nodes (4): pmo_send_logs_expiry_idx, pmo_send_logs_success_time_idx, pmo_send_logs_user_time_idx, public.pmo_send_logs

### Community 63 - "Delete Requests SQL"
Cohesion: 0.70
Nodes (4): pmo_management_delete_requests_pending_identifier_idx, pmo_management_delete_requests_requester_idx, pmo_management_delete_requests_status_idx, public.pmo_management_delete_requests

### Community 66 - "Text Import Format Docs"
Cohesion: 0.67
Nodes (3): Alertas de horas (faltan / exacto / excede), Formato de texto aceptado (fecha / rango hora descripción | cliente | ricef | proyecto | solicitud), TimeRecordDomainService (parse, validación, cálculo de horas)

## Ambiguous Edges - Review These
- `ui-modal.component.ts` → `MultipleImportPageComponent`  [AMBIGUOUS]
  src/presentation/shared/components/ui-modal/ui-modal.component.html · relation: conceptually_related_to
- `ui-state-message.component.ts` → `Alertas de horas (faltan / exacto / excede)`  [AMBIGUOUS]
  src/presentation/shared/components/ui-state-message/ui-state-message.component.html · relation: conceptually_related_to

## Knowledge Gaps
- **38 isolated node(s):** `@angular/compiler`, `tslib`, `@angular/build`, `@angular/cli`, `@angular/compiler-cli` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 397 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **54 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MultipleImportPageComponent` connect `Multiple Import Page Core` to `Management Name Normalization`, `Management Template Gateway`, `App Parameters Facade`, `Excel Import Parsing`, `Management Report Deletion`, `Template Required Fields`, `Routing & Environment`, `Send All Records Results`, `Report Period & Daily Hours`, `Shared Pipes & Directives`, `Report Date Filtering & Duplication`, `Management Edit Persistence`, `Draft Import & Send Flow`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **What connects `@angular/compiler`, `tslib`, `@angular/build` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Config & Audit Gateways` be split into smaller, more focused modules?**
  _Cohesion score 0.06227106227106227 - nodes in this community are weakly interconnected._
- **Why does `@angular/core` connect `Shared Pipes & Directives` to `App Config & Audit Gateways`, `Management Template Gateway`, `App Parameters Facade`, `Analytics Charts (Chart.js)`, `Consultant Locations`, `Delete Requests Gateway`, `UI Field & Form Section Types`, `Template Required Fields`, `Routing & Environment`, `Icons & App Host`, `Send Log Gateway`, `Package Metadata`, `Time Record Model & Alerts`, `Time Management Gateway`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Should `Management Template Gateway` be split into smaller, more focused modules?**
  _Cohesion score 0.060362173038229376 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `ui-modal.component.ts` and `MultipleImportPageComponent`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `ui-state-message.component.ts` and `Alertas de horas (faltan / exacto / excede)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._