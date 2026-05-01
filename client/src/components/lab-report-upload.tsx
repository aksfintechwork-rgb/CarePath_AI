import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload, FileText, Loader2, AlertTriangle, CheckCircle2,
  Eye, X, Sparkles, TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LabReportUploadProps {
  test: any;
  visitId: string;
  isApproved: boolean;
}

export default function LabReportUpload({ test, visitId, isApproved }: LabReportUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showReport, setShowReport] = useState(false);
  const [showValues, setShowValues] = useState(false);

  const { data: reportData, isLoading: reportLoading } = useQuery<any>({
    queryKey: ["/api/tests", test.id, "report"],
    enabled: !!test.id,
  });

  const currentTest = reportData || test;
  const hasReport = !!currentTest.reportBase64;
  const hasValues = currentTest.reportValues && Array.isArray(currentTest.reportValues) && currentTest.reportValues.length > 0;
  const hasAbnormals = currentTest.abnormalMarkers && Array.isArray(currentTest.abnormalMarkers) && currentTest.abnormalMarkers.length > 0;

  const uploadMutation = useMutation({
    mutationFn: async (data: { reportBase64: string; labName?: string; status?: string }) => {
      const res = await apiRequest("POST", `/api/tests/${test.id}/report`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests", test.id, "report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId] });
      toast({ title: "Report uploaded", description: "Lab report has been uploaded successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const extractMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tests/${test.id}/extract-values`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests", test.id, "report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId] });
      setShowValues(true);
      toast({ title: "Values extracted", description: "AI has extracted key values from the report." });
    },
    onError: (err: any) => {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("POST", `/api/tests/${test.id}/report`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests", test.id, "report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId] });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "File too large", description: "Please upload a file under 5MB.", variant: "destructive" });
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, WebP, or PDF file.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      uploadMutation.mutate({ reportBase64: base64, status: "completed" });
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "booked": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-amber-100 text-amber-700 border-amber-200";
    }
  };

  const getValueIcon = (status: string) => {
    if (status === "high") return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
    if (status === "low") return <TrendingDown className="h-3.5 w-3.5 text-blue-500" />;
    return <Minus className="h-3.5 w-3.5 text-green-500" />;
  };

  const getValueRowClass = (status: string) => {
    if (status === "high") return "bg-red-50 border-l-2 border-l-red-400";
    if (status === "low") return "bg-blue-50 border-l-2 border-l-blue-400";
    return "";
  };

  return (
    <div className="mt-3 space-y-3" data-testid={`lab-report-${test.id}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={currentTest.status || "recommended"}
          onValueChange={(val) => statusMutation.mutate(val)}
          disabled={isApproved && currentTest.status === "completed"}
        >
          <SelectTrigger className={`h-7 w-auto min-w-[110px] text-xs gap-1 px-2 ${getStatusColor(currentTest.status || "recommended")}`} data-testid={`select-test-status-${test.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">Recommended</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        {currentTest.labName && (
          <span className="text-xs text-muted-foreground">Lab: {currentTest.labName}</span>
        )}
      </div>

      {!hasReport && (
        <div className="border border-dashed border-muted-foreground/30 rounded-lg p-4 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileSelect}
            data-testid={`input-upload-report-${test.id}`}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            data-testid={`button-upload-report-${test.id}`}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadMutation.isPending ? "Uploading..." : "Upload Lab Report"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">JPG, PNG, WebP or PDF (max 5MB)</p>
        </div>
      )}

      {hasReport && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowReport(!showReport)}
              data-testid={`button-view-report-${test.id}`}
            >
              {showReport ? <X className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showReport ? "Hide Report" : "View Report"}
            </Button>

            {!hasValues && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => extractMutation.mutate()}
                disabled={extractMutation.isPending}
                data-testid={`button-extract-values-${test.id}`}
              >
                {extractMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {extractMutation.isPending ? "Extracting..." : "AI Extract Values"}
              </Button>
            )}

            {hasValues && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setShowValues(!showValues)}
                data-testid={`button-toggle-values-${test.id}`}
              >
                <FileText className="h-3.5 w-3.5" />
                {showValues ? "Hide Values" : "Show Values"}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
              data-testid={`button-reupload-report-${test.id}`}
            >
              <Upload className="h-3.5 w-3.5" />
              Re-upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {showReport && currentTest.reportBase64 && (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                {currentTest.reportBase64.startsWith("data:application/pdf") ? (
                  <div className="text-center py-4">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">PDF report uploaded</p>
                  </div>
                ) : (
                  <img
                    src={currentTest.reportBase64}
                    alt={`Lab report for ${test.name}`}
                    className="max-w-full rounded-md"
                    data-testid={`img-report-${test.id}`}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {hasAbnormals && (
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded-md">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-xs font-medium text-red-700">
                {currentTest.abnormalMarkers.length} abnormal marker{currentTest.abnormalMarkers.length > 1 ? "s" : ""} detected
              </span>
            </div>
          )}

          {showValues && hasValues && (
            <Card>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Extracted Values
                  </h5>
                  {hasAbnormals && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                      {currentTest.abnormalMarkers.length} Abnormal
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  {currentTest.reportValues.map((val: any, i: number) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between py-1.5 px-2 rounded text-xs ${getValueRowClass(val.status)}`}
                      data-testid={`row-report-value-${test.id}-${i}`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getValueIcon(val.status)}
                        <span className="font-medium truncate">{val.parameter}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`font-semibold ${val.status === "high" ? "text-red-600" : val.status === "low" ? "text-blue-600" : "text-green-600"}`}>
                          {val.value}
                        </span>
                        {val.referenceRange && (
                          <span className="text-muted-foreground text-[11px]">
                            Ref: {val.referenceRange}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {hasAbnormals && (
                  <div className="pt-2 border-t space-y-2">
                    <h6 className="text-xs font-semibold text-red-700 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Abnormal Markers
                    </h6>
                    {currentTest.abnormalMarkers.map((marker: any, i: number) => (
                      <div
                        key={i}
                        className="bg-red-50 border border-red-100 rounded p-2 text-xs"
                        data-testid={`row-abnormal-marker-${test.id}-${i}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-red-800">{marker.parameter}</span>
                          <Badge variant="outline" className={`text-[10px] h-5 ${marker.status === "high" ? "bg-red-100 text-red-700 border-red-300" : "bg-blue-100 text-blue-700 border-blue-300"}`}>
                            {marker.status === "high" ? "HIGH" : "LOW"}
                          </Badge>
                        </div>
                        <div className="mt-1 text-red-700">
                          Value: <span className="font-semibold">{marker.value}</span>
                          {marker.referenceRange && <span className="ml-2 text-red-500">(Ref: {marker.referenceRange})</span>}
                        </div>
                        {marker.significance && (
                          <p className="mt-1 text-red-600 italic">{marker.significance}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
