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
  growth_rate?: number;
  citation: Citation;
}

export interface FinancialSection {
  company: string;
  ticker?: string;
  revenue: FinancialMetric[];
  gross_profit: FinancialMetric[];
  ebitda: FinancialMetric[];
  net_income: FinancialMetric[];
  total_debt: FinancialMetric[];
  cash_and_equivalents: FinancialMetric[];
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
