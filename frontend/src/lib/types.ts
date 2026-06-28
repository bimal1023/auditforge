export interface ReportRequest {
  company_name: string;
  ticker?: string;
  focus_areas: string[];
  context?: string;
  force_refresh?: boolean;
}

export interface Citation {
  source: string;
  url?: string;
  filing_date?: string;
  accession_number?: string;
  excerpt?: string;
}

export interface FinancialMetric {
  value: number;
  year: number;
  period?: string;        // e.g. "Q1 FY2026" or "FY2025"
  growth_rate?: number;
  citation: Citation;
}

export interface SegmentBreakdown {
  name: string;
  revenue?: number;
  operating_income?: number;
  margin?: number;
  growth_rate?: number;
  notes?: string;
}

export interface CashFlowAnalysis {
  operating_cash_flow?: number;
  capital_expenditure?: number;
  free_cash_flow?: number;
  dividends_paid?: number;
  share_repurchases?: number;
  fcf_margin?: number;
  period?: string;
  citation?: Citation;
}

export interface BalanceSheetHealth {
  current_ratio?: number;
  debt_to_equity?: number;
  net_debt?: number;
  interest_coverage?: number;
  total_assets?: number;
  stockholders_equity?: number;
  period?: string;
  citation?: Citation;
}

export interface MarginAnalysis {
  gross_margin?: number;
  operating_margin?: number;
  net_margin?: number;
  fcf_margin?: number;
  rnd_intensity?: number;
  sga_ratio?: number;
  period?: string;
}

export interface FinancialSection {
  company: string;
  ticker?: string;
  period_of_report?: string;
  filing_type?: string;

  // Core metrics
  revenue: FinancialMetric[];
  cost_of_revenue?: FinancialMetric[];
  gross_profit: FinancialMetric[];
  operating_income?: FinancialMetric[];
  ebitda: FinancialMetric[];
  net_income: FinancialMetric[];
  eps_diluted?: FinancialMetric[];
  total_debt: FinancialMetric[];
  cash_and_equivalents: FinancialMetric[];

  // PE-grade sub-sections
  segments?: SegmentBreakdown[];
  cash_flow?: CashFlowAnalysis;
  balance_sheet?: BalanceSheetHealth;
  margins?: MarginAnalysis;
  capital_allocation?: string;
  management_notes?: string;
  investment_highlights?: string[];
  key_concerns?: string[];

  key_ratios: Record<string, number>;
  summary: string;
  citations: Citation[];
  confidence_score: number;
}

export interface RiskFactor {
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  citation: Citation;
}

export interface RiskSection {
  company: string;
  risks: RiskFactor[];
  summary: string;
  citations: Citation[];
  confidence_score: number;
}

export interface Competitor {
  name: string;
  estimated_market_share?: number;
  notes?: string;
}

export interface MarketSection {
  company: string;
  market_size_usd?: number;
  market_share?: number;
  competitors: Competitor[];
  growth_drivers: string[];
  headwinds: string[];
  summary: string;
  citations: Citation[];
  confidence_score: number;
}

export interface LitigationItem {
  case_name: string;
  status: string;
  potential_liability_usd?: number;
  description: string;
  citation: Citation;
}

export interface LegalSection {
  company: string;
  litigations: LitigationItem[];
  regulatory_issues: { agency?: string; description?: string; status?: string; potential_fine_usd?: number | null }[];
  summary: string;
  citations: Citation[];
  confidence_score: number;
}

export interface ReportSummary {
  id: string;
  status: string;
  company: string;
  ticker?: string;
  overall_score?: number;
  generated_at?: string;
}

export interface Report {
  id: string;
  company: string;
  ticker?: string;
  financial?: FinancialSection;
  risk?: RiskSection;
  market?: MarketSection;
  legal?: LegalSection;
  executive_summary?: string;
  overall_score?: number;
  status: "pending" | "running" | "complete" | "error";
  error?: string;
  generated_at: string;
}

// ── Watchlist ─────────────────────────────────────────────────────────────

export interface WatchlistEvent {
  id: string;
  event_type: "no_change" | "minor_change" | "material_change";
  severity: "none" | "low" | "medium" | "high";
  summary: string;
  details?: {
    changes?: { category: string; title: string; description: string; severity: string; source: string }[];
    confidence_score?: number;
  };
  detected_at: string;
  acknowledged: boolean;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_user_id?: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  company: string;
  ticker?: string;
  scan_frequency: "daily" | "weekly";
  last_scan_at?: string;
  last_drift_at?: string;
  baseline_report_id?: string;
  status: "active" | "paused" | "archived";
  created_at: string;
  archived_at?: string;
  latest_event?: WatchlistEvent;
  unacknowledged_count: number;
}

export interface WatchlistResponse {
  items: WatchlistItem[];
  slots: { used: number; max: number };
}

// ── Team / Workspace ────────────────────────────────────────────────────────

export type WorkspaceRole = "admin" | "analyst" | "viewer";

export interface WorkspaceMember {
  id: string;
  user_id: string;
  email: string;
  full_name?: string | null;
  role: WorkspaceRole;
  joined_at: string;
}

export interface WorkspaceInvite {
  id: string;
  email: string;
  role: WorkspaceRole;
  invited_by_email?: string | null;
  expires_at: string;
  created_at: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  plan_tier: string;
  member_count: number;
  seat_limit: number;
}

// ── Usage ───────────────────────────────────────────────────────────────────

export interface UsageSummary {
  plan_tier: string;
  subscription_status?: string | null;
  current_period_end?: string | null;
  memo: {
    used: number;
    remaining: number;
    limit: number;
    percent: number;
    unlimited: boolean;
    warning?: {
      level: "none" | "warning" | "critical";
      message: string | null;
    };
  };
  reports: { this_cycle: number; total: number };
  watchlist: { used: number; max: number; unlimited: boolean };
}

// ── Deal Action Queue ───────────────────────────────────────────────────────

export type ActionCategory =
  | "financial" | "legal" | "market" | "risk" | "management" | "operational";
export type ActionPriority = "high" | "medium" | "low";
export type ActionStatus = "open" | "in_progress" | "done" | "dismissed";

export interface DealAction {
  id: string;
  report_id: string;
  title: string;
  description: string;
  category: ActionCategory;
  priority: ActionPriority;
  rationale: string;
  status: ActionStatus;
  origin: "auto" | "manual";
  created_at: string;
}

// ── Deal Stage Pipeline ───────────────────────────────────────────────────────

export type PipelineStage =
  | "sourced" | "screening" | "diligence" | "ic_review" | "closing" | "won" | "passed";
export type DealConviction = "high" | "medium" | "low";

export interface Deal {
  id: string;
  company: string;
  ticker?: string | null;
  report_id?: string | null;
  /** Linked report status — drives the Deep Dive running/ready card state. */
  report_status?: "pending" | "running" | "complete" | "error" | null;
  stage: PipelineStage;
  position: number;
  deal_size_usd?: number | null;
  conviction?: DealConviction | null;
  notes: string;
  stage_updated_at: string;
  created_at: string;
  updated_at: string;
}

// ── Collaboration types ─────────────────────────────────────────────────────

export interface CommentItem {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  target_type: "report" | "deal";
  target_id: string;
  body: string;
  mentions: string[];
  edited_at: string | null;
  created_at: string;
}

export interface ActivityEventItem {
  id: string;
  event_type: string;
  actor_email: string | null;
  actor_name: string | null;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  notification_type: string;
  read: boolean;
  comment_id: string | null;
  comment_preview: string | null;
  comment_target_type: string | null;
  comment_target_id: string | null;
  author_email: string | null;
  author_name: string | null;
  created_at: string;
}
