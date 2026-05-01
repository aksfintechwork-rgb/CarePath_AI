import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Receipt, Search, Loader2, FileText, ArrowLeft, Tag,
  Plus, Trash2, CheckCircle, Clock, AlertTriangle, RotateCcw,
  Download, IndianRupee, Calendar, Percent, Hash, Pencil
} from "lucide-react";

type ViewMode = "invoices" | "invoice-detail" | "coupons" | "create-coupon" | "edit-coupon";

const authHeaders = () => {
  const token = getSessionToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

function InvoiceStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
    overdue: "bg-red-100 text-red-700 border-red-200",
    refunded: "bg-purple-100 text-purple-700 border-purple-200",
    cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  };
  const icons: Record<string, any> = { pending: Clock, paid: CheckCircle, overdue: AlertTriangle, refunded: RotateCcw };
  const Icon = icons[status] || Clock;
  return (
    <span data-testid={`badge-invoice-${status}`} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${colors[status] || colors.pending}`}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function BillingManagement() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>("invoices");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [refundDialog, setRefundDialog] = useState<any>(null);
  const [generateDialog, setGenerateDialog] = useState(false);
  const [generateDoctorId, setGenerateDoctorId] = useState("");
  const [editCouponData, setEditCouponData] = useState<any>(null);

  const { data: invoicesData = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/admin/invoices", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/invoices?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: view === "invoices" || view === "invoice-detail",
  });

  const { data: invoiceDetail } = useQuery({
    queryKey: ["/api/admin/invoices", selectedInvoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/invoices/${selectedInvoiceId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: view === "invoice-detail" && !!selectedInvoiceId,
  });

  const { data: couponsData = [], isLoading: couponsLoading } = useQuery({
    queryKey: ["/api/admin/coupons"],
    queryFn: async () => {
      const res = await fetch("/api/admin/coupons", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: view === "coupons" || view === "create-coupon" || view === "edit-coupon",
  });

  const { data: doctorSubs = [] } = useQuery({
    queryKey: ["/api/admin/doctor-subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/doctor-subscriptions", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const generateInvoice = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/invoices/generate", { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (inv) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      toast({ title: `Invoice ${inv.invoiceNumber} generated` });
      setGenerateDialog(false);
      setGenerateDoctorId("");
    },
    onError: (e: any) => toast({ title: e.message || "Failed to generate invoice", variant: "destructive" }),
  });

  const generateAll = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/invoices/generate-all", { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      toast({ title: `Generated ${data.generated} invoices${data.errors ? `, ${data.errors} errors` : ""}` });
    },
    onError: () => toast({ title: "Failed to generate invoices", variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, refundReason }: { id: string; status: string; refundReason?: string }) => {
      const res = await fetch(`/api/admin/invoices/${id}/status`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ status, refundReason }) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      toast({ title: "Invoice status updated" });
      setRefundDialog(null);
    },
    onError: () => toast({ title: "Failed to update invoice", variant: "destructive" }),
  });

  const createCoupon = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/coupons", { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Coupon created" });
      setView("coupons");
    },
    onError: (e: any) => toast({ title: e.message || "Failed to create coupon", variant: "destructive" }),
  });

  const toggleCoupon = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ isActive }) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Coupon updated" });
    },
    onError: () => toast({ title: "Failed to update coupon", variant: "destructive" }),
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Coupon deleted" });
    },
    onError: () => toast({ title: "Failed to delete coupon", variant: "destructive" }),
  });

  const editCoupon = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Coupon updated" });
      setView("coupons");
      setEditCouponData(null);
    },
    onError: (e: any) => toast({ title: e.message || "Failed to update coupon", variant: "destructive" }),
  });

  const filtered = invoicesData.filter((inv: any) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return inv.invoiceNumber?.toLowerCase().includes(q) || inv.doctorName?.toLowerCase().includes(q) || inv.doctorEmail?.toLowerCase().includes(q);
    }
    return true;
  });

  const statusCounts = {
    all: invoicesData.length,
    pending: invoicesData.filter((i: any) => i.status === "pending").length,
    paid: invoicesData.filter((i: any) => i.status === "paid").length,
    overdue: invoicesData.filter((i: any) => i.status === "overdue").length,
    refunded: invoicesData.filter((i: any) => i.status === "refunded").length,
  };

  const subscribedDoctors = doctorSubs.filter((d: any) => d.subscription && d.subscription.status !== "cancelled" && d.subscription.status !== "expired");

  if (view === "invoice-detail" && invoiceDetail) return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setView("invoices")} data-testid="button-back-to-invoices">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Invoice {invoiceDetail.invoiceNumber}</h1>
        <InvoiceStatusBadge status={invoiceDetail.status} />
      </div>

      <div className="bg-card rounded-xl border p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Doctor</p>
            <p className="font-medium">{invoiceDetail.doctor?.name}</p>
            <p className="text-xs text-muted-foreground">{invoiceDetail.doctor?.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Clinic</p>
            <p className="text-sm">{invoiceDetail.doctor?.clinicName || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Billing Period</p>
            <p className="text-sm">
              {invoiceDetail.billingPeriodStart ? new Date(invoiceDetail.billingPeriodStart).toLocaleDateString() : "—"}
              {" — "}
              {invoiceDetail.billingPeriodEnd ? new Date(invoiceDetail.billingPeriodEnd).toLocaleDateString() : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="text-sm">{invoiceDetail.plan?.name || "—"}</p>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-2 text-sm font-medium">Description</th>
                <th className="text-right px-4 py-2 text-sm font-medium">Qty</th>
                <th className="text-right px-4 py-2 text-sm font-medium">Unit Price</th>
                <th className="text-right px-4 py-2 text-sm font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {(invoiceDetail.lineItems || []).map((item: any) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-2 text-sm">{item.description}</td>
                  <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                  <td className="px-4 py-2 text-sm text-right">₹{item.unitPrice}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium">₹{item.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={3} className="px-4 py-2 text-sm text-right font-medium">Subtotal</td>
                <td className="px-4 py-2 text-sm text-right font-medium">₹{invoiceDetail.subtotal}</td>
              </tr>
              {invoiceDetail.discount > 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-sm text-right text-emerald-600">Discount</td>
                  <td className="px-4 py-2 text-sm text-right text-emerald-600">-₹{invoiceDetail.discount}</td>
                </tr>
              )}
              <tr className="bg-muted/50 font-bold">
                <td colSpan={3} className="px-4 py-2 text-right">Total</td>
                <td className="px-4 py-2 text-right">₹{invoiceDetail.total}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {invoiceDetail.refundReason && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm font-medium text-purple-800">Refund Reason</p>
            <p className="text-sm text-purple-700">{invoiceDetail.refundReason}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          {invoiceDetail.status === "pending" && (
            <>
              <Button size="sm" onClick={() => updateStatus.mutate({ id: invoiceDetail.id, status: "paid" })} data-testid="button-mark-paid">
                <CheckCircle className="h-4 w-4 mr-1" /> Mark Paid
              </Button>
              <Button size="sm" variant="outline" className="text-amber-600" onClick={() => updateStatus.mutate({ id: invoiceDetail.id, status: "overdue" })} data-testid="button-mark-overdue">
                <AlertTriangle className="h-4 w-4 mr-1" /> Mark Overdue
              </Button>
            </>
          )}
          {(invoiceDetail.status === "paid" || invoiceDetail.status === "pending") && (
            <Button size="sm" variant="outline" className="text-purple-600" onClick={() => setRefundDialog(invoiceDetail)} data-testid="button-refund">
              <RotateCcw className="h-4 w-4 mr-1" /> Refund
            </Button>
          )}
          <Button size="sm" variant="outline" data-testid="button-download-invoice-pdf" onClick={() => {
            const token = getSessionToken();
            const url = `/api/admin/invoices/${invoiceDetail.id}/pdf`;
            fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
              .then(r => { if (!r.ok) throw new Error("Failed"); return r.blob(); })
              .then(blob => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `invoice-${invoiceDetail.invoiceNumber || invoiceDetail.id}.pdf`;
                a.click();
                URL.revokeObjectURL(a.href);
              })
              .catch(() => toast({ title: "Error", description: "Failed to download invoice PDF", variant: "destructive" }));
          }}>
            <Download className="h-4 w-4 mr-1" /> Download PDF
          </Button>
        </div>
      </div>

      {refundDialog && <RefundDialog invoice={refundDialog} onRefund={(reason: string) => updateStatus.mutate({ id: refundDialog.id, status: "refunded", refundReason: reason })} onClose={() => setRefundDialog(null)} />}
    </div>
  );

  if (view === "coupons") return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("invoices")} data-testid="button-back-to-billing">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold">Coupon Management</h1>
        </div>
        <Button size="sm" onClick={() => setView("create-coupon")} data-testid="button-create-coupon">
          <Plus className="h-4 w-4 mr-1" /> New Coupon
        </Button>
      </div>

      {couponsLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {couponsData.map((coupon: any) => (
            <div key={coupon.id} data-testid={`card-coupon-${coupon.id}`} className={`bg-card rounded-xl border p-5 space-y-3 ${!coupon.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <span className="font-bold text-lg font-mono">{coupon.code}</span>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full border ${coupon.isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                  {coupon.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {coupon.description && <p className="text-sm text-muted-foreground">{coupon.description}</p>}
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium text-primary">
                  {coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `₹${coupon.discountValue} off`}
                </span>
                <span className="text-muted-foreground">
                  Used: {coupon.currentUses || 0}{coupon.maxUses ? `/${coupon.maxUses}` : ""}
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {coupon.validFrom && <p>From: {new Date(coupon.validFrom).toLocaleDateString()}</p>}
                {coupon.validUntil && <p>Until: {new Date(coupon.validUntil).toLocaleDateString()}</p>}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditCouponData(coupon); setView("edit-coupon"); }} data-testid={`button-edit-coupon-${coupon.id}`}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleCoupon.mutate({ id: coupon.id, isActive: !coupon.isActive })} data-testid={`button-toggle-coupon-${coupon.id}`}>
                  {coupon.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm(`Delete coupon ${coupon.code}?`)) deleteCoupon.mutate(coupon.id); }} data-testid={`button-delete-coupon-${coupon.id}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {couponsData.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">No coupons yet</div>
          )}
        </div>
      )}
    </div>
  );

  if (view === "create-coupon") return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setView("coupons")} data-testid="button-back-to-coupons">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Create Coupon</h1>
      </div>
      <CouponForm onSubmit={(data: any) => createCoupon.mutate(data)} isLoading={createCoupon.isPending} />
    </div>
  );

  if (view === "edit-coupon" && editCouponData) return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => { setView("coupons"); setEditCouponData(null); }} data-testid="button-back-from-edit-coupon">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Edit Coupon: {editCouponData.code}</h1>
      </div>
      <CouponForm
        initialData={editCouponData}
        isEdit
        onSubmit={(data: any) => editCoupon.mutate({ id: editCouponData.id, ...data })}
        isLoading={editCoupon.isPending}
      />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Billing & Invoices"
        subtitle="Manage invoices, payments, and coupons"
        icon={Receipt}
        iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
        testId="text-billing-title"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setView("coupons")} data-testid="button-coupons">
              <Tag className="h-4 w-4 mr-1.5" /> Coupons
            </Button>
            <Button variant="outline" size="sm" onClick={() => setGenerateDialog(true)} data-testid="button-generate-invoice">
              <Plus className="h-4 w-4 mr-1.5" /> Generate Invoice
            </Button>
            <Button size="sm" onClick={() => generateAll.mutate()} disabled={generateAll.isPending} data-testid="button-generate-all">
              {generateAll.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1.5" />}
              Generate All
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-search-invoices" className="pl-9" placeholder="Search invoices..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "pending", "paid", "overdue", "refunded"] as const).map(s => (
            <button key={s} data-testid={`filter-invoice-${s}`} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)} ({(statusCounts as any)[s] || 0})
            </button>
          ))}
        </div>
      </div>

      {invoicesLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 text-sm font-medium">Invoice #</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Doctor</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Period</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Date</th>
                <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv: any) => (
                <tr key={inv.id} data-testid={`row-invoice-${inv.id}`} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => { setSelectedInvoiceId(inv.id); setView("invoice-detail"); }}>
                  <td className="px-4 py-3 font-mono text-sm font-medium">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{inv.doctorName}</p>
                    <p className="text-xs text-muted-foreground">{inv.doctorEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {inv.billingPeriodStart ? new Date(inv.billingPeriodStart).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">₹{inv.total}</td>
                  <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {inv.status === "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: inv.id, status: "paid" })} data-testid={`button-pay-${inv.id}`}>
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setSelectedInvoiceId(inv.id); setView("invoice-detail"); }} data-testid={`button-view-invoice-${inv.id}`}>
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No invoices found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {generateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setGenerateDialog(false)}>
          <div className="bg-card rounded-xl border shadow-lg w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Generate Invoice</h2>
            <div>
              <Label>Doctor</Label>
              <select data-testid="select-generate-doctor" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={generateDoctorId} onChange={e => setGenerateDoctorId(e.target.value)}>
                <option value="">Select a doctor...</option>
                {subscribedDoctors.map((d: any) => (
                  <option key={d.doctor.id} value={d.doctor.id}>{d.doctor.name} ({d.plan?.name || "No plan"})</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setGenerateDialog(false)}>Cancel</Button>
              <Button onClick={() => generateInvoice.mutate({ doctorId: generateDoctorId })} disabled={!generateDoctorId || generateInvoice.isPending} data-testid="button-confirm-generate">
                {generateInvoice.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Generate
              </Button>
            </div>
          </div>
        </div>
      )}

      {refundDialog && <RefundDialog invoice={refundDialog} onRefund={(reason: string) => updateStatus.mutate({ id: refundDialog.id, status: "refunded", refundReason: reason })} onClose={() => setRefundDialog(null)} />}
    </div>
  );
}

function RefundDialog({ invoice, onRefund, onClose }: any) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Refund Invoice {invoice.invoiceNumber}</h2>
        <p className="text-sm text-muted-foreground">Amount: ₹{invoice.total}</p>
        <div>
          <Label>Refund Reason</Label>
          <Input data-testid="input-refund-reason" placeholder="Reason for refund..." value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => onRefund(reason)} disabled={!reason} data-testid="button-confirm-refund">
            Process Refund
          </Button>
        </div>
      </div>
    </div>
  );
}

function CouponForm({ onSubmit, isLoading, initialData, isEdit }: { onSubmit: (data: any) => void; isLoading: boolean; initialData?: any; isEdit?: boolean }) {
  const formatDate = (d: any) => d ? new Date(d).toISOString().split("T")[0] : "";
  const [form, setForm] = useState({
    code: initialData?.code || "",
    description: initialData?.description || "",
    discountType: initialData?.discountType || "percentage",
    discountValue: initialData?.discountValue ?? 10,
    maxUses: initialData?.maxUses != null ? String(initialData.maxUses) : "",
    validFrom: formatDate(initialData?.validFrom),
    validUntil: formatDate(initialData?.validUntil),
    isActive: initialData?.isActive ?? true,
  });

  const update = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="bg-card rounded-xl border p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Coupon Code</Label>
          <Input data-testid="input-coupon-code" placeholder="e.g. SAVE20" value={form.code} onChange={e => update("code", e.target.value.toUpperCase())} disabled={isEdit} />
        </div>
        <div>
          <Label>Description</Label>
          <Input data-testid="input-coupon-description" placeholder="Optional description" value={form.description} onChange={e => update("description", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Discount Type</Label>
          <select data-testid="select-discount-type" className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.discountType} onChange={e => update("discountType", e.target.value)}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (₹)</option>
          </select>
        </div>
        <div>
          <Label>Discount Value</Label>
          <Input data-testid="input-discount-value" type="number" step="0.01" min="0" value={form.discountValue} onChange={e => update("discountValue", parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <Label>Max Uses (empty = unlimited)</Label>
          <Input data-testid="input-max-uses" type="number" placeholder="Unlimited" value={form.maxUses} onChange={e => update("maxUses", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Valid From</Label>
          <Input data-testid="input-valid-from" type="date" value={form.validFrom} onChange={e => update("validFrom", e.target.value)} />
        </div>
        <div>
          <Label>Valid Until</Label>
          <Input data-testid="input-valid-until" type="date" value={form.validUntil} onChange={e => update("validUntil", e.target.value)} />
        </div>
      </div>

      {isEdit && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => update("isActive", e.target.checked)} data-testid="checkbox-coupon-active" />
          <Label htmlFor="isActive">Active</Label>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={() => onSubmit({
          ...form,
          maxUses: form.maxUses ? parseInt(form.maxUses) : null,
          validFrom: form.validFrom || null,
          validUntil: form.validUntil || null,
        })} disabled={!form.code || isLoading} data-testid="button-save-coupon">
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {isEdit ? "Update Coupon" : "Create Coupon"}
        </Button>
      </div>
    </div>
  );
}
