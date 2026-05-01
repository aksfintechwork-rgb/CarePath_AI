import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Search as SearchIcon,
  Filter,
  Calendar,
  Globe,
  X,
  ArrowRight,
  FileText,
  User,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";

const ROWS_PER_PAGE = 10;

const SUPPORTED_LANGUAGES = [
  "English", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Gujarati", "Punjabi",
  "Urdu", "Odia", "Assamese", "Sanskrit", "Nepali", "Konkani", "Goan Konkani", "Sindhi", "Kashmiri", "Maithili", "Dogri",
  "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Russian", "Polish", "Czech", "Romanian",
  "Mandarin Chinese", "Cantonese", "Japanese", "Korean", "Thai", "Vietnamese", "Indonesian", "Malay", "Filipino",
  "Arabic", "Persian", "Turkish", "Hebrew", "Swahili", "Amharic", "Hausa", "Yoruba", "Zulu",
  "Swedish", "Norwegian", "Danish", "Finnish", "Greek", "Hungarian", "Ukrainian", "Serbian", "Croatian", "Bulgarian",
];

const STATUS_OPTIONS = ["all", "draft", "active", "recording", "cancelled"];

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "active":
      return (
        <Badge data-testid={`badge-status-${status}`} className="bg-emerald-100 text-emerald-700 border-emerald-200 shadow-none">
          <span className="relative flex h-2 w-2 mr-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Active
        </Badge>
      );
    case "draft":
      return <Badge data-testid={`badge-status-${status}`} variant="outline" className="text-violet-600 border-violet-200 bg-violet-50">Draft</Badge>;
    case "recording":
      return (
        <Badge data-testid={`badge-status-${status}`} variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
          <span className="relative flex h-2 w-2 mr-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          Recording
        </Badge>
      );
    case "cancelled":
      return <Badge data-testid={`badge-status-${status}`} variant="secondary" className="bg-gray-100 text-gray-600">Cancelled</Badge>;
    default:
      return <Badge data-testid={`badge-status-${status}`} variant="outline">{status}</Badge>;
  }
};

export default function SearchPage() {
  const [, setLocation] = useLocation();

  const [patientNameInput, setPatientNameInput] = useState("");
  const [status, setStatus] = useState("all");
  const [language, setLanguage] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (patientNameInput) params.set("patientName", patientNameInput);
    if (status && status !== "all") params.set("status", status);
    if (language && language !== "all") params.set("language", language);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params.toString();
  };

  const handleSearch = () => {
    setPage(1);
    setSubmittedQuery(buildQueryString());
  };

  const { data: results, isLoading, isFetching } = useQuery<any[]>({
    queryKey: ["/api/search/visits", submittedQuery ? `?${submittedQuery}` : ""],
  });

  const clearFilters = () => {
    setPatientNameInput("");
    setStatus("all");
    setLanguage("all");
    setDateFrom("");
    setDateTo("");
    setSubmittedQuery("");
    setPage(1);
  };

  const hasActiveFilters = patientNameInput || status !== "all" || language !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Advanced Search"
        subtitle="Search and filter patient visits"
        icon={SearchIcon}
        iconBg="bg-gradient-to-br from-blue-500 to-violet-600"
        testId="text-search-title"
      />

      <div className="glass-card-strong rounded-xl animate-fade-up" style={{ animationDelay: "0.1s" }} data-testid="card-filters">
        <div className="p-6 pb-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-500" />
            Filters
          </h3>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Patient Name
              </label>
              <Input
                data-testid="input-patient-name"
                placeholder="Search by patient name..."
                value={patientNameInput}
                onChange={(e) => setPatientNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Status
              </label>
              <Select value={status} onValueChange={setStatus} data-testid="select-status">
                <SelectTrigger data-testid="select-status-trigger">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} data-testid={`select-status-option-${s}`}>
                      {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                Language
              </label>
              <Select value={language} onValueChange={setLanguage} data-testid="select-language">
                <SelectTrigger data-testid="select-language-trigger">
                  <SelectValue placeholder="All languages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="select-language-option-all">All</SelectItem>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang} data-testid={`select-language-option-${lang}`}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                From Date
              </label>
              <Input
                data-testid="input-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                To Date
              </label>
              <Input
                data-testid="input-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              data-testid="button-search"
              className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white"
              onClick={handleSearch}
            >
              <SearchIcon className="mr-2 h-4 w-4" />
              Search
            </Button>
            {hasActiveFilters && (
              <Button
                data-testid="button-clear-filters"
                variant="outline"
                onClick={clearFilters}
              >
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card-strong rounded-xl animate-fade-up" style={{ animationDelay: "0.2s" }} data-testid="card-results">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Results
            </h3>
            {results && (
              <Badge variant="secondary" data-testid="badge-result-count">
                Showing {Math.min((page - 1) * ROWS_PER_PAGE + 1, results.length)}-{Math.min(page * ROWS_PER_PAGE, results.length)} of {results.length} result{results.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
        <div className="px-6 pb-6">
          {isLoading || isFetching ? (
            <div className="space-y-3" data-testid="loading-skeleton">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : results && results.length > 0 ? (
            <>
            <div className="glass-table rounded-xl">
              <Table data-testid="table-results">
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Visit Date</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE).map((visit: any) => (
                    <TableRow key={visit.id} data-testid={`row-visit-${visit.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                            {visit.patient?.name?.charAt(0) || "?"}
                          </div>
                          <span className="font-medium" data-testid={`text-patient-name-${visit.id}`}>
                            {visit.patient?.name || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-patient-age-${visit.id}`}>
                        {visit.patient?.age ? `${visit.patient.age} yrs` : "—"}
                      </TableCell>
                      <TableCell data-testid={`text-visit-date-${visit.id}`}>
                        {new Date(visit.visitDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell data-testid={`text-language-${visit.id}`}>
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                          {visit.language}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={visit.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          data-testid={`button-view-visit-${visit.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(`/visit/${visit.id}`)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          View
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(results.length / ROWS_PER_PAGE)}
              onPageChange={setPage}
            />
            </>
          ) : (
            <div className="text-center py-12" data-testid="empty-results">
              <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <SearchIcon className="h-8 w-8 text-blue-400" />
              </div>
              <p className="text-lg font-semibold text-foreground">No results found</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Try adjusting your filters or search terms to find patient visits.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
