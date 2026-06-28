"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, LogOut, X } from "lucide-react";

import { Logo } from "@/components/Logo";
import { apiFetch, logout, getToken } from "@/lib/auth";
import { useIsMobile } from "@/lib/hooks";
import { useCredits } from "@/lib/useCredits";
import type { Report, ReportSummary } from "@/lib/types";

import { ReportViewer } from "@/components/ReportViewer";
import { RecentReports } from "@/components/RecentReports";
import { UploadDocument } from "@/components/UploadDocument";
import { LibraryView } from "@/components/LibraryView";
import { TemplatesView } from "@/components/TemplatesView";
import { ActivityView } from "@/components/ActivityView";
import { SearchModal } from "@/components/SearchModal";
import { WatchlistView } from "@/components/WatchlistView";
import { PipelineView } from "@/components/PipelineView";
import { DealRoomQA } from "@/components/DealRoomQA";
import { SettingsView } from "@/components/SettingsView";
import { EarningsView } from "@/components/EarningsView";
import { CompsView } from "@/components/CompsView";
import { ScreenerView } from "@/components/ScreenerView";
import { UsageView } from "@/components/UsageView";

import { CSS } from "./css";
import type { NavTab, NewReportInitial } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { NewReportForm } from "./components/NewReportForm";
import { RunPipeline } from "./components/RunPipeline";
import { ComingSoon } from "./components/ComingSoon";
import WorkspaceActivityFeed from "@/components/WorkspaceActivityFeed";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { UpgradeGate } from "./components/UpgradeGate";
import { TeamView } from "./components/TeamView";
import { useReportRun } from "./hooks/useReportRun";

export default function DashboardPage() {
  const router   = useRouter();
  const isMobile = useIsMobile();

  // ── Auth + identity ──────────────────────────────────────────────────────────
  const [ready,    setReady]    = useState(false);
  const [userName, setUserName] = useState("Analyst");
  const [workspaceRole, setWorkspaceRole] = useState<string>("admin");
  const [workspaceName, setWorkspaceName] = useState<string>("");

  // ── UI state (which tab, search, form prefill) ───────────────────────────────
  const [activeTab,   setActiveTab]   = useState<NavTab>("new-report");
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [recentCount, setRecentCount] = useState(0);
  const [formKey,     setFormKey]     = useState(0);
  const [formInitial, setFormInitial] = useState<NewReportInitial | undefined>(undefined);
  const [watchlistAlertCount, setWatchlistAlertCount] = useState(0);
  const [usagePercent, setUsagePercent] = useState<number | null>(null);
  const [teamMemberCount, setTeamMemberCount] = useState(0);
  const [liveCount, setLiveCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  // ── Report-run lifecycle (SSE, polling, agent state) ─────────────────────────
  const run = useReportRun();
  const {
    report, statusMsg, error, agents, activeReq, polling, refreshKey,
    phase, runStatus,
    setReport, setError,
    handleSubmit, handleAbort, handleSelectHistorical,
  } = run;

  // ── Credit balance (3 free for solo, refreshes after each run) ───────────────
  const { credits, planTier, refresh: refreshCredits } = useCredits();

  // Refresh credits whenever a report run completes (refreshKey bumps).
  useEffect(() => { refreshCredits(); }, [refreshKey, refreshCredits]);

  // ── Auth check + me fetch on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    apiFetch("/api/v1/auth/me").then(async (res) => {
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.email) setUserName(data.full_name || data.email.split("@")[0]);
        if (data?.workspace_role) setWorkspaceRole(data.workspace_role);
        if (data?.workspace_name) setWorkspaceName(data.workspace_name);
        setReady(true);
      }
    });
  }, [router]);

  // ── Deep link: /app?report=<id> opens that report once on load ───────────────
  useEffect(() => {
    if (!ready) return;
    const id = new URLSearchParams(window.location.search).get("report");
    if (!id) return;
    window.history.replaceState(null, "", "/app");
    handleOpenReportById(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ── Sidebar count badges: Memos (total) + Live monitor (in-flight runs) ──────
  // One fetch feeds both — Memos is the full count, Live monitor counts only
  // reports still running/queued (the green "live" badge hides at zero).
  useEffect(() => {
    if (!ready) return;
    apiFetch("/api/v1/reports")
      .then((r) => r.ok ? r.json() : [])
      .then((data: ReportSummary[]) => {
        if (!Array.isArray(data)) { setRecentCount(0); setLiveCount(0); return; }
        setRecentCount(data.length);
        setLiveCount(data.filter((r) => r.status === "running" || r.status === "pending").length);
      })
      .catch(() => {});
  }, [ready, refreshKey]);

  // ── Sidebar Knowledge base badge: uploaded document count ────────────────────
  useEffect(() => {
    if (!ready) return;
    apiFetch("/api/v1/documents")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setDocCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
  }, [ready, refreshKey]);

  // ── Topbar bell badge: unacknowledged watchlist alerts (fetched on load) ─────
  useEffect(() => {
    if (!ready) return;
    apiFetch("/api/v1/watchlist")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const items = data?.items;
        if (!Array.isArray(items)) return;
        const total = items.reduce(
          (sum: number, it: { unacknowledged_count?: number }) => sum + (it.unacknowledged_count ?? 0),
          0,
        );
        setWatchlistAlertCount(total);
      })
      .catch(() => {});
  }, [ready]);

  // ── Team member count badge ──────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    apiFetch("/api/v1/team/info")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.member_count) setTeamMemberCount(data.member_count); })
      .catch(() => {});
  }, [ready]);

  // ── Notification count badge (polls every 30s) ──────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const fetchCount = () =>
      apiFetch("/api/v1/notifications/count")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data && typeof data.unread === "number") setNotifCount(data.unread); })
        .catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [ready]);

  // ── Sidebar Usage badge: memo-usage percent (refreshes when a run completes) ─
  useEffect(() => {
    if (!ready) return;
    apiFetch("/api/v1/billing/usage")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.memo) return;
        setUsagePercent(data.memo.unlimited ? null : data.memo.percent);
      })
      .catch(() => {});
  }, [ready, refreshKey]);

  // ── ⌘K opens search modal ────────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Templates view → prefill form + jump to new-report tab ───────────────────
  function handleUseTemplate(t: { focus_areas: string[]; context: string }) {
    setFormInitial({ focus_areas: t.focus_areas, context: t.context });
    setFormKey((k) => k + 1);
    setActiveTab("new-report");
    setReport(null);
    setError(null);
  }

  function handleOpenFromLibrary(r: Report) {
    handleSelectHistorical(r);
    setActiveTab("new-report");
  }

  // Pipeline "Open deep dive report" → fetch the linked report, then view it.
  async function handleOpenReportById(reportId: string) {
    try {
      const res = await apiFetch(`/api/v1/reports/${reportId}`);
      if (!res.ok) return;
      const r: Report = await res.json();
      handleSelectHistorical(r);
      setActiveTab("new-report");
    } catch {
      /* swallow — the card stays put if the fetch fails */
    }
  }

  function handleTabChange(t: NavTab) {
    setActiveTab(t);
    if (t === "new-report") setReport(null);
  }

  function handleBack() {
    if (report) setReport(null);
    else if (activeTab !== "new-report") setActiveTab("new-report");
  }

  function handleSignOut() {
    logout().finally(() => router.push("/login"));
  }

  if (!ready) return null;

  // ── Mobile: drop sidebar, show simple top header ─────────────────────────────
  if (isMobile) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="af-app" style={{ flexDirection: "column" }}>
          <div className="topbar" style={{ padding: "0 16px" }}>
            <div className="sb-mark" style={{ width: 28, height: 28 }}><Logo variant="onDark" size={18} /></div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--n900)" }}>Arthvion</div>
            <div className="tb-spacer" />
            <button className="tb-icon-btn" onClick={() => setSearchOpen(true)}><Search size={15} /></button>
            <button className="tb-signout" onClick={handleSignOut}>
              <LogOut size={14} />
            </button>
          </div>
          <div className="content">
            <div className="content-inner">
              {phase === "idle" && activeTab === "new-report" && (
                <NewReportForm
                  key={formKey}
                  onSubmit={handleSubmit}
                  loading={false}
                  credits={credits}
                  planTier={planTier}
                  initialValues={formInitial}
                />
              )}
              {phase === "generating" && activeReq && (
                <RunPipeline
                  req={activeReq} agents={agents} statusMsg={statusMsg}
                  polling={polling} onAbort={handleAbort}
                />
              )}
              {phase === "loaded" && report && <ReportViewer report={report} />}
              {error && <div className="err-banner"><X size={14} /> {error}</div>}
            </div>
          </div>
          <SearchModal
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            onSelect={handleSelectHistorical}
          />
        </div>
      </>
    );
  }

  // ── Desktop: full sidebar + topbar ───────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="af-app">
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          userName={userName}
          onSearchOpen={() => setSearchOpen(true)}
          recentCount={recentCount}
          liveCount={liveCount}
          docCount={docCount}
          watchlistAlertCount={watchlistAlertCount}
          usagePercent={usagePercent}
          planTier={planTier}
          teamMemberCount={teamMemberCount}
          workspaceRole={workspaceRole}
          workspaceName={workspaceName}
        />
        <div className="main-col">
          <div style={{ position: "relative" }}>
            <Topbar
              activeTab={activeTab}
              runStatus={runStatus}
              onBack={handleBack}
              onSignOut={handleSignOut}
              onSearchOpen={() => setSearchOpen(true)}
              onNotifications={() => setNotifOpen((v) => !v)}
              alertCount={notifCount + watchlistAlertCount}
            />
            <NotificationsDropdown
              open={notifOpen}
              onClose={() => { setNotifOpen(false); setNotifCount(0); }}
              onNavigate={(targetType, targetId) => {
                setNotifOpen(false);
                if (targetType === "report") {
                  handleOpenReportById(targetId);
                } else if (targetType === "deal") {
                  setActiveTab("pipeline");
                }
              }}
            />
          </div>

          <div className="content">
            <div className="content-inner">
              {/* ── New report ── */}
              {activeTab === "new-report" && (
                <>
                  {phase === "idle" && (
                    <NewReportForm
                      key={formKey}
                      onSubmit={handleSubmit}
                      loading={false}
                      credits={credits}
                      planTier={planTier}
                      initialValues={formInitial}
                      onShowHistory={() => handleTabChange("memos")}
                    />
                  )}
                  {phase === "generating" && activeReq && (
                    <RunPipeline
                      req={activeReq} agents={agents} statusMsg={statusMsg}
                      polling={polling} onAbort={handleAbort}
                    />
                  )}
                  {phase === "loaded" && report && (
                    <div className="slide-up">
                      <ReportViewer report={report} />
                    </div>
                  )}
                  {error && (
                    <div className="err-banner" style={{ marginTop: 14 }}>
                      <X size={14} /> {error}
                    </div>
                  )}

                  {/* Recent reports on the idle screen */}
                  {phase === "idle" && (
                    <div style={{ marginTop: 32 }}>
                      <RecentReports
                        onSelect={handleSelectHistorical}
                        refreshKey={refreshKey}
                        onViewAll={() => setActiveTab("memos")}
                      />
                    </div>
                  )}
                </>
              )}

              {/* ── Memos (LibraryView) ── */}
              {activeTab === "memos" && (
                <div className="slide-up">
                  <div className="page-head">
                    <div className="page-head-text">
                      <div className="page-head-title"><h1>Memos</h1></div>
                      <p className="page-head-sub">Your previously dispatched diligence memos.</p>
                    </div>
                  </div>
                  <LibraryView onOpen={handleOpenFromLibrary} />
                </div>
              )}

              {/* ── Live monitor ── */}
              {activeTab === "live-monitor" && (
                <div className="slide-up">
                  <div className="page-head">
                    <div className="page-head-text">
                      <div className="page-head-title"><h1>Live monitor</h1></div>
                      <p className="page-head-sub">Real-time activity from your agent stack.</p>
                    </div>
                  </div>
                  <ActivityView />
                </div>
              )}

              {/* ── Knowledge base ── */}
              {activeTab === "knowledge-base" && (
                <div className="slide-up">
                  <div className="page-head">
                    <div className="page-head-text">
                      <div className="page-head-title"><h1>Knowledge base</h1></div>
                      <p className="page-head-sub">Upload source documents and ask questions about them.</p>
                    </div>
                  </div>
                  <UploadDocument />
                  <div style={{ marginTop: "var(--s-200)" }}>
                    <DealRoomQA />
                  </div>
                </div>
              )}

              {/* ── Templates ── */}
              {activeTab === "templates" && (
                <div className="slide-up">
                  <div className="page-head">
                    <div className="page-head-text">
                      <div className="page-head-title"><h1>Templates</h1></div>
                      <p className="page-head-sub">Pre-built focus mixes for common diligence shapes.</p>
                    </div>
                  </div>
                  <TemplatesView onUseTemplate={handleUseTemplate} />
                </div>
              )}

              {/* ── Coming-soon placeholders ── */}
              {activeTab === "watchlist" && (
                <div className="slide-up">
                  <div className="page-head">
                    <div className="page-head-text">
                      <div className="page-head-title"><h1>Portfolio</h1></div>
                      <p className="page-head-sub">Monitor portfolio companies for material changes and drift alerts.</p>
                    </div>
                  </div>
                  <WatchlistView planTier={planTier} onAlertCount={setWatchlistAlertCount} />
                </div>
              )}
              {activeTab === "pipeline" && (
                <div className="slide-up">
                  <div className="page-head">
                    <div className="page-head-text">
                      <div className="page-head-title"><h1>Pipeline</h1></div>
                      <p className="page-head-sub">Track deals through the diligence funnel — from sourced to closed.</p>
                    </div>
                  </div>
                  <PipelineView onOpenReport={handleOpenReportById} />
                </div>
              )}
              {activeTab === "earnings" && (
                planTier === "solo"
                  ? <UpgradeGate feature="Earnings" description="Analyze earnings call transcripts with AI-powered insights. Upgrade to Desk to unlock." />
                  : <div className="slide-up">
                      <div className="page-head">
                        <div className="page-head-text">
                          <div className="page-head-title"><h1>Earnings</h1></div>
                          <p className="page-head-sub">Analyze earnings call transcripts with AI-powered insights.</p>
                        </div>
                      </div>
                      <EarningsView />
                    </div>
              )}
              {activeTab === "comps" && (
                planTier === "solo"
                  ? <UpgradeGate feature="Comps" description="Comparable companies analysis — valuation multiples vs peer group. Upgrade to Desk to unlock." />
                  : <div className="slide-up">
                      <div className="page-head">
                        <div className="page-head-text">
                          <div className="page-head-title"><h1>Comps</h1></div>
                          <p className="page-head-sub">Comparable companies analysis — valuation multiples vs peer group.</p>
                        </div>
                      </div>
                      <CompsView />
                    </div>
              )}
              {activeTab === "screener" && (
                planTier === "solo"
                  ? <UpgradeGate feature="Screener" description="Find companies by sector, market cap, exchange, and fundamentals. Upgrade to Desk to unlock." />
                  : <div className="slide-up">
                      <div className="page-head">
                        <div className="page-head-text">
                          <div className="page-head-title"><h1>Screener</h1></div>
                          <p className="page-head-sub">Find companies by sector, market cap, exchange, and fundamentals.</p>
                        </div>
                      </div>
                      <ScreenerView />
                    </div>
              )}
              {activeTab === "citations" && <ComingSoon title="Citations" />}
              {activeTab === "activity" && (
                <div className="slide-up">
                  <WorkspaceActivityFeed />
                </div>
              )}
              {activeTab === "team" && (
                <div className="slide-up">
                  <div className="page-head">
                    <div className="page-head-text">
                      <div className="page-head-title"><h1>Team</h1></div>
                      <p className="page-head-sub">Manage workspace members, roles, and invitations.</p>
                    </div>
                  </div>
                  <TeamView workspaceRole={workspaceRole} />
                </div>
              )}
              {activeTab === "usage" && (
                <div className="slide-up">
                  <div className="page-head">
                    <div className="page-head-text">
                      <div className="page-head-title"><h1>Usage</h1></div>
                      <p className="page-head-sub">Your memo credits, report activity, and watchlist slots this billing cycle.</p>
                    </div>
                  </div>
                  <UsageView onUsagePercent={setUsagePercent} />
                </div>
              )}
              {activeTab === "settings" && (
                <div className="slide-up">
                  <div className="page-head">
                    <div className="page-head-text">
                      <div className="page-head-title"><h1>Settings</h1></div>
                      <p className="page-head-sub">Manage your profile, security, and billing.</p>
                    </div>
                  </div>
                  <SettingsView planTier={planTier} credits={credits} onRefreshCredits={refreshCredits} />
                </div>
              )}
            </div>
          </div>
        </div>

        <SearchModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelect={handleSelectHistorical}
        />
      </div>
    </>
  );
}
