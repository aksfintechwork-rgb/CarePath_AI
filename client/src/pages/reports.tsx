import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { FeatureGate } from "@/components/upgrade-prompt";
import { useQuery } from "@tanstack/react-query";
import { getSessionToken } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, 
  Download, 
  Calendar, 
  Users, 
  Activity, 
  Pill, 
  TestTube, 
  Clock,
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  Printer,
} from "lucide-react";
import { Pagination } from "@/components/pagination";
import { useAuth } from "@/hooks/use-auth";

function PageHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

type Period = "daily" | "weekly" | "monthly";

const ROWS_PER_PAGE = 10;

export default function ReportsPage() {
  const { user } = useAuth();
  const doctorName = user?.name || "Doctor";
  const [period, setPeriodRaw] = useState<Period>("daily");
  const [selectedDate, setSelectedDateRaw] = useState(new Date());
  const setPeriod = (p: Period) => { setPeriodRaw(p); setReportPage(1); setActiveFilter(null); };
  const setSelectedDate = (d: Date) => { setSelectedDateRaw(d); setReportPage(1); setActiveFilter(null); };
  const [reportPage, setReportPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const [calendarPos, setCalendarPos] = useState({ top: 0, left: 0 });

  const updateCalendarPos = useCallback(() => {
    if (toggleBtnRef.current) {
      const rect = toggleBtnRef.current.getBoundingClientRect();
      setCalendarPos({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2 - 160,
      });
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        calendarRef.current && !calendarRef.current.contains(target) &&
        toggleBtnRef.current && !toggleBtnRef.current.contains(target)
      ) {
        setCalendarOpen(false);
      }
    };
    if (calendarOpen) {
      document.addEventListener("mousedown", handler);
      window.addEventListener("scroll", updateCalendarPos, true);
      window.addEventListener("resize", updateCalendarPos);
    }
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", updateCalendarPos, true);
      window.removeEventListener("resize", updateCalendarPos);
    };
  }, [calendarOpen, updateCalendarPos]);

  const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  const { data: report, isLoading } = useQuery({
    queryKey: ["/api/reports", period, dateStr],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/reports?period=${period}&date=${dateStr}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
  });

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate);
    if (period === "daily") d.setDate(d.getDate() + dir);
    else if (period === "weekly") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setSelectedDate(d);
  };

  const formatDateRange = () => {
    if (period === "daily") {
      return selectedDate.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    }
    if (!report) return "";
    const [sy, sm, sd] = report.startDate.split("T")[0].split("-").map(Number);
    const [ey, em, ed] = report.endDate.split("T")[0].split("-").map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed - 1);
    return `${start.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  };

  const buildReportHtml = () => {
    if (!report || !report.visits.length) return null;

    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
    const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    const doctorPhoto = (user?.profilePhoto || "").startsWith("data:image/") ? user!.profilePhoto : "";
    const doctorPhone = esc(user?.phone || "");
    const doctorEmail = esc(user?.email || "");
    const doctorClinicName = esc(user?.clinicName || "");
    const doctorClinicAddress = esc(user?.clinicAddress || "");
    const title = `${esc(doctorName)} - ${periodLabel} Report`;
    const range = formatDateRange();

    let medsTable = "";
    let visitRows = "";
    let visitIndex = 0;

    for (const item of report.visits) {
      visitIndex++;
      const visitTime = formatTime(item.visit.visitDate);
      const visitDate = formatDate(item.visit.visitDate);
      const statusColor = item.visit.status === "active" ? "#16a34a" : item.visit.status === "draft" ? "#eab308" : "#6b7280";

      visitRows += `<tr>
        <td>${visitIndex}</td>
        <td><strong>${item.patient?.name || "Unknown"}</strong><br/><span style="color:#888;font-size:11px">${item.patient?.age || "—"} yrs, ${item.patient?.gender || "—"}</span></td>
        <td>${visitDate}<br/><span style="color:#888;font-size:11px">${visitTime}</span></td>
        <td><span style="background:${statusColor}15;color:${statusColor};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">${item.visit.status}</span></td>
        <td>${item.visit.complaint || "—"}</td>
        <td>${item.visit.diagnosis ? (Array.isArray(item.visit.diagnosis) ? item.visit.diagnosis.join(", ") : item.visit.diagnosis) : "—"}</td>
        <td>${item.medicines.length}</td>
        <td>${item.tests.length}</td>
      </tr>`;

      if (item.medicines.length > 0) {
        medsTable += `<tr style="background:#f0f7ff"><td colspan="7" style="font-weight:600;padding:8px 12px">Visit #${visitIndex} — ${item.patient?.name || "Unknown"} (${visitDate})</td></tr>`;
        item.medicines.forEach((med: any, i: number) => {
          medsTable += `<tr>
            <td>${i + 1}</td>
            <td>${med.name}</td>
            <td>${med.dose || "—"}</td>
            <td>${med.frequency || "—"}</td>
            <td>${med.timing || "—"}</td>
            <td>${med.instructions || "—"}</td>
          </tr>`;
        });
      }
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body { font-family: 'Segoe UI', sans-serif; padding: 30px; color: #1e293b; font-size: 13px; display: flex; flex-direction: column; min-height: 100vh; }
  .content-wrapper { flex: 1; }
  .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 15px; }
  .header-logo { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 6px; }
  .header-logo img { width: 50px; height: 50px; object-fit: cover; border-radius: 50%; border: 2px solid #2563eb; }
  .header h1 { font-size: 22px; color: #2563eb; margin-bottom: 4px; }
  .header p { color: #64748b; font-size: 13px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 25px; }
  .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; text-align: center; }
  .stat-box .value { font-size: 24px; font-weight: 700; color: #2563eb; }
  .stat-box .label { font-size: 11px; color: #64748b; margin-top: 2px; }
  .section { margin-bottom: 25px; }
  .section h2 { font-size: 16px; color: #1e293b; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; color: #475569; padding: 8px 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:hover { background: #fafafa; }
  .footer { margin-top: 30px; padding-top: 15px; border-top: 2px solid #e2e8f0; color: #64748b; font-size: 11px; }
  .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 8px; }
  .footer-grid div { font-size: 12px; }
  .footer-grid strong { color: #2563eb; }
  .footer-note { text-align: right; font-size: 10px; color: #94a3b8; margin-top: 8px; }
  @page { margin: 10mm; margin-bottom: 5mm; }
  @media print { body { padding: 15px; } .summary-grid { grid-template-columns: repeat(3, 1fr); } }
</style></head><body>
<div class="content-wrapper">
<div class="header">
  <div class="header-logo">
    ${doctorPhoto ? `<img src="${doctorPhoto}" alt="Doctor Photo" />` : `<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#3b82f6);display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:700;border:2px solid #2563eb">${(doctorName || "D").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0,2)}</div>`}
    <div style="text-align:left">
      <h1 style="margin:0">${title}</h1>
      <p>${range}</p>
    </div>
  </div>
</div>

<div class="summary-grid">
  <div class="stat-box"><div class="value">${report.summary.totalVisits}</div><div class="label">Total Visits</div></div>
  <div class="stat-box"><div class="value">${report.summary.uniquePatients}</div><div class="label">Unique Patients</div></div>
  <div class="stat-box"><div class="value">${report.summary.activeVisits}</div><div class="label">Approved Plans</div></div>
  <div class="stat-box"><div class="value">${report.summary.draftVisits}</div><div class="label">Drafts</div></div>
  <div class="stat-box"><div class="value">${report.summary.totalMedicines}</div><div class="label">Medicines Prescribed</div></div>
  <div class="stat-box"><div class="value">${report.summary.totalTests}</div><div class="label">Tests Ordered</div></div>
</div>

<div class="section">
  <h2>Visit Details</h2>
  ${report.visits.length > 0 ? `<table>
    <thead><tr><th>#</th><th>Patient</th><th>Date & Time</th><th>Status</th><th>Complaint</th><th>Provisional Diagnosis</th><th>Meds</th><th>Tests</th></tr></thead>
    <tbody>${visitRows}</tbody>
  </table>` : `<p style="color:#94a3b8;padding:20px 0;text-align:center">No visits found for this period.</p>`}
</div>

${medsTable ? `<div class="section">
  <h2>Prescription Details</h2>
  <table>
    <thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Timing</th><th>Duration</th></tr></thead>
    <tbody>${medsTable}</tbody>
  </table>
</div>` : ""}
</div>

<div class="footer">
  <div class="footer-grid">
    ${doctorPhone ? `<div><strong>Phone:</strong> ${doctorPhone}</div>` : ""}
    ${doctorEmail ? `<div><strong>Email:</strong> ${doctorEmail}</div>` : ""}
    ${doctorClinicName ? `<div><strong>Clinic:</strong> ${doctorClinicName}</div>` : ""}
    ${doctorClinicAddress ? `<div><strong>Address:</strong> ${doctorClinicAddress}</div>` : ""}
  </div>
  <p class="footer-note">Generated on ${new Date().toLocaleString()} | carepath.ai powered by Codelyne Technologies</p>
</div>
</body></html>`;

    return html;
  };

  const printReport = () => {
    const html = buildReportHtml();
    if (!html) return;
    const existingFrame = document.getElementById("print-report-frame");
    if (existingFrame) existingFrame.remove();
    const iframe = document.createElement("iframe");
    iframe.id = "print-report-frame";
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 1000);
      }, 300);
    }
  };

  const downloadPdf = () => {
    const html = buildReportHtml();
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Report_${period}_${dateStr}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const stats = report?.summary || { totalVisits: 0, uniquePatients: 0, activeVisits: 0, draftVisits: 0, totalMedicines: 0, totalTests: 0 };

  const getFilteredVisits = () => {
    const allVisits = report?.visits || [];
    if (!activeFilter || activeFilter === "total") return allVisits;
    if (activeFilter === "approved") return allVisits.filter((v: any) => v.visit.status === "active");
    if (activeFilter === "drafts") return allVisits.filter((v: any) => v.visit.status === "draft");
    if (activeFilter === "medicines") return allVisits.filter((v: any) => v.medicines.length > 0);
    if (activeFilter === "tests") return allVisits.filter((v: any) => v.tests.length > 0);
    if (activeFilter === "patients") {
      const seen = new Set<string>();
      return allVisits.filter((v: any) => {
        const pid = v.patient?.id || v.visit.patientId;
        if (seen.has(pid)) return false;
        seen.add(pid);
        return true;
      });
    }
    return allVisits;
  };

  return (
    <FeatureGate feature="reportsLevel">
    <div data-testid="page-reports">
      <PageHeader icon={FileBarChart} title="Generate Reports" subtitle="Download daily, weekly, and monthly patient reports with prescriptions" />

      <div className="glass-card p-4 mb-6" data-testid="report-controls">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex bg-muted/50 rounded-lg p-1 gap-1">
            {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? "default" : "ghost"}
                size="sm"
                onClick={() => setPeriod(p)}
                className={period === p ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md" : "text-muted-foreground hover:text-foreground"}
                data-testid={`button-period-${p}`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDate(-1)} data-testid="button-prev-date">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <button
                ref={toggleBtnRef}
                onClick={() => { setCalendarMonth(new Date(selectedDate)); updateCalendarPos(); setCalendarOpen(!calendarOpen); }}
                className="text-sm font-medium min-w-[200px] text-center flex items-center justify-center gap-2 cursor-pointer hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200"
                data-testid="button-calendar-toggle"
              >
                <Calendar className="h-4 w-4 text-blue-500" />
                {formatDateRange() || "Loading..."}
              </button>
              {calendarOpen && createPortal((() => {
                const cm = calendarMonth;
                const year = cm.getFullYear();
                const month = cm.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const today = new Date(); today.setHours(0,0,0,0);
                const sel = new Date(selectedDate); sel.setHours(0,0,0,0);
                const days: (number | null)[] = [];
                for (let i = 0; i < firstDay; i++) days.push(null);
                for (let i = 1; i <= daysInMonth; i++) days.push(i);
                const weeks: (number | null)[][] = [];
                for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
                if (weeks[weeks.length - 1].length < 7) {
                  while (weeks[weeks.length - 1].length < 7) weeks[weeks.length - 1].push(null);
                }
                return (
                  <div ref={calendarRef} className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-[320px] animate-in fade-in zoom-in-95 duration-200" style={{ zIndex: 99999, top: calendarPos.top, left: calendarPos.left }} data-testid="calendar-dropdown">
                    <div className="flex items-center justify-between mb-3">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} data-testid="button-cal-prev-month">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-semibold text-foreground">
                        {cm.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} data-testid="button-cal-next-month">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 mb-1">
                      {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                        <div key={d} className="text-xs font-medium text-muted-foreground text-center py-1">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-0.5">
                      {weeks.flat().map((day, i) => {
                        if (day === null) return <div key={`empty-${i}`} className="h-9" />;
                        const date = new Date(year, month, day);
                        date.setHours(0,0,0,0);
                        const isSelected = date.getTime() === sel.getTime();
                        const isToday = date.getTime() === today.getTime();
                        return (
                          <button
                            key={`day-${day}`}
                            onClick={() => { setSelectedDate(new Date(year, month, day)); setCalendarOpen(false); }}
                            className={`h-9 w-full rounded-lg text-sm font-medium transition-all ${
                              isSelected
                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                                : isToday
                                  ? "bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-200"
                                  : "text-foreground hover:bg-blue-50 hover:text-blue-600"
                            }`}
                            data-testid={`button-cal-day-${day}`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between">
                      <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-800" onClick={() => { setSelectedDate(new Date()); setCalendarMonth(new Date()); setCalendarOpen(false); }} data-testid="button-cal-today">
                        Today
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setCalendarOpen(false)}>
                        Close
                      </Button>
                    </div>
                  </div>
                );
              })(), document.body)}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDate(1)} data-testid="button-next-date">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="sm:ml-auto flex gap-2">
            <Button
              onClick={printReport}
              disabled={!report?.visits?.length}
              variant="outline"
              className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
              data-testid="button-print-report"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              onClick={downloadPdf}
              disabled={!report?.visits?.length}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-md"
              data-testid="button-download-report"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Total Visits", value: stats.totalVisits, icon: Activity, color: "from-blue-500 to-blue-600", filterKey: "total" },
          { label: "Unique Patients", value: stats.uniquePatients, icon: Users, color: "from-indigo-500 to-indigo-600", filterKey: "patients" },
          { label: "Approved Plans", value: stats.activeVisits, icon: FileText, color: "from-green-500 to-green-600", filterKey: "approved" },
          { label: "Drafts", value: stats.draftVisits, icon: Clock, color: "from-amber-500 to-amber-600", filterKey: "drafts" },
          { label: "Medicines", value: stats.totalMedicines, icon: Pill, color: "from-purple-500 to-purple-600", filterKey: "medicines" },
          { label: "Tests Ordered", value: stats.totalTests, icon: TestTube, color: "from-cyan-500 to-cyan-600", filterKey: "tests" },
        ].map((stat) => (
          <Card
            key={stat.label}
            className={`glass-card border-white/40 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${activeFilter === stat.filterKey ? "ring-2 ring-blue-400 shadow-lg border-blue-200" : "hover:border-blue-200"}`}
            data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={() => { setActiveFilter(activeFilter === stat.filterKey ? null : stat.filterKey); setReportPage(1); }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-sm`}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground">{isLoading ? "..." : stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card-strong border-white/40 mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            {activeFilter === "total" ? "All Visits" :
             activeFilter === "patients" ? "Unique Patients" :
             activeFilter === "approved" ? "Approved Plans" :
             activeFilter === "drafts" ? "Draft Visits" :
             activeFilter === "medicines" ? "Visits with Medicines" :
             activeFilter === "tests" ? "Visits with Tests" :
             "Visit Details"}
            {(() => {
              const filtered = getFilteredVisits();
              return filtered.length > 0 ? (
                <Badge variant="secondary" className="ml-2">{filtered.length} {activeFilter === "patients" ? "patients" : "visits"}</Badge>
              ) : null;
            })()}
            {activeFilter && (
              <Button variant="ghost" size="sm" className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setActiveFilter(null)}>
                Clear filter
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading report data...</div>
          ) : (() => {
            const filteredVisits = getFilteredVisits();
            return !filteredVisits.length ? (
            <div className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No visits found for this period</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try selecting a different date range</p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Complaint</TableHead>
                    <TableHead className="hidden md:table-cell">Provisional Diagnosis</TableHead>
                    <TableHead className="text-center">Meds</TableHead>
                    <TableHead className="text-center">Tests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVisits.slice((reportPage - 1) * ROWS_PER_PAGE, reportPage * ROWS_PER_PAGE).map((item: any, idx: number) => (
                    <TableRow key={item.visit.id} data-testid={`row-visit-${item.visit.id}`}>
                      <TableCell className="font-medium text-muted-foreground">{(reportPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.patient?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{item.patient?.age || "—"} yrs, {item.patient?.gender || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(item.visit.visitDate)}</div>
                        <div className="text-xs text-muted-foreground">{formatTime(item.visit.visitDate)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          item.visit.status === "active" ? "bg-green-50 text-green-700 border-green-200" :
                          item.visit.status === "draft" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-gray-50 text-gray-600 border-gray-200"
                        }>
                          {item.visit.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate hidden md:table-cell">{item.visit.complaint || "—"}</TableCell>
                      <TableCell className="max-w-[150px] truncate hidden md:table-cell">
                        {item.visit.diagnosis ? (Array.isArray(item.visit.diagnosis) ? item.visit.diagnosis.join(", ") : item.visit.diagnosis) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-purple-50 text-purple-700">{item.medicines.length}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-cyan-50 text-cyan-700">{item.tests.length}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              currentPage={reportPage}
              totalPages={Math.ceil(filteredVisits.length / ROWS_PER_PAGE)}
              onPageChange={setReportPage}
            />
            </>
          );
          })()}
        </CardContent>
      </Card>

      {report?.visits?.some((v: any) => v.medicines.length > 0) && (
        <Card className="glass-card-strong border-white/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Pill className="h-5 w-5 text-purple-600" />
              Prescription Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.visits.filter((v: any) => v.medicines.length > 0).map((item: any, idx: number) => (
                <div key={item.visit.id}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                      {item.patient?.name || "Unknown"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(item.visit.visitDate)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableHead className="w-[30px]">#</TableHead>
                          <TableHead>Medicine</TableHead>
                          <TableHead>Dosage</TableHead>
                          <TableHead className="hidden sm:table-cell">Frequency</TableHead>
                          <TableHead className="hidden sm:table-cell">Timing</TableHead>
                          <TableHead className="hidden md:table-cell">Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {item.medicines.map((med: any, i: number) => (
                          <TableRow key={med.id}>
                            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="font-medium">{med.name}</TableCell>
                            <TableCell>{med.dose || "—"}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
                                {med.frequency || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100">
                                {med.timing || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{med.instructions || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {idx < report.visits.filter((v: any) => v.medicines.length > 0).length - 1 && (
                    <div className="border-t border-dashed border-gray-200 mt-4" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </FeatureGate>
  );
}
