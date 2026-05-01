import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  Loader2,
  Sparkles,
  IndianRupee,
  Beaker,
  Tag,
} from "lucide-react";

interface MedicineAlternative {
  id: string;
  medicineId: string;
  visitId: string;
  alternativeName: string;
  saltComposition: string | null;
  genericName: string | null;
  manufacturer: string | null;
  priceEstimate: string | null;
  type: string | null;
  selected: boolean;
}

interface MedicineAlternativesProps {
  medicineId: string;
  medicineName: string;
  visitId: string;
  isDraft: boolean;
}

export function MedicineAlternatives({ medicineId, medicineName, visitId, isDraft }: MedicineAlternativesProps) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const { data: alternatives = [], isLoading: loadingAlts } = useQuery<MedicineAlternative[]>({
    queryKey: ["/api/visits", visitId, "alternatives", medicineId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/visits/${visitId}/alternatives`);
      const all: MedicineAlternative[] = await res.json();
      return all.filter((a) => a.medicineId === medicineId);
    },
    enabled: expanded && !!visitId && !!medicineId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/medicines/${medicineId}/alternatives`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId, "alternatives", medicineId] });
      toast({ title: "Alternatives Generated", description: `Found alternatives for ${medicineName}` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const swapMutation = useMutation({
    mutationFn: async (alternativeId: string) => {
      const res = await apiRequest("POST", `/api/medicines/${medicineId}/swap-alternative`, { alternativeId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId] });
      queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId, "alternatives", medicineId] });
      toast({ title: "Medicine Swapped", description: "Prescription updated with the selected alternative." });
    },
    onError: (err: Error) => {
      toast({ title: "Swap Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleExpand = () => {
    setExpanded(!expanded);
    if (!expanded && alternatives.length === 0 && !loadingAlts) {
      generateMutation.mutate();
    }
  };

  const typeColor = (type: string | null) => {
    switch (type?.toLowerCase()) {
      case "generic":
        return "bg-green-50 text-green-700 border-green-200";
      case "branded":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "lower-cost":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "same-salt":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="mt-1" data-testid={`alternatives-section-${medicineId}`}>
      <button
        onClick={handleExpand}
        className="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors py-1"
        data-testid={`button-toggle-alternatives-${medicineId}`}
      >
        <Sparkles className="h-3 w-3" />
        <span>{expanded ? "Hide" : "View"} Alternatives</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 animate-in slide-in-from-top-2 duration-200" data-testid={`alternatives-list-${medicineId}`}>
          {(generateMutation.isPending || loadingAlts) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Finding alternatives for {medicineName}...</span>
            </div>
          )}

          {!generateMutation.isPending && !loadingAlts && alternatives.length === 0 && (
            <div className="text-xs text-muted-foreground py-2 text-center">
              No alternatives found.{" "}
              <button
                onClick={() => generateMutation.mutate()}
                className="text-primary underline hover:no-underline"
                data-testid={`button-retry-alternatives-${medicineId}`}
              >
                Try again
              </button>
            </div>
          )}

          {alternatives.length > 0 && (
            <div className="border rounded-lg overflow-hidden bg-white">
              <div className="bg-muted/30 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {alternatives.length} alternative{alternatives.length !== 1 ? "s" : ""} found
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  data-testid={`button-refresh-alternatives-${medicineId}`}
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                </Button>
              </div>

              <div className="divide-y">
                {alternatives.map((alt) => (
                  <div
                    key={alt.id}
                    className={`px-3 py-2.5 flex items-start gap-3 hover:bg-accent/5 transition-colors ${alt.selected ? "bg-green-50/50" : ""}`}
                    data-testid={`alternative-item-${alt.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate" data-testid={`text-alt-name-${alt.id}`}>
                          {alt.alternativeName}
                        </span>
                        {alt.type && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-4 ${typeColor(alt.type)}`}
                            data-testid={`badge-alt-type-${alt.id}`}
                          >
                            <Tag className="h-2.5 w-2.5 mr-0.5" />
                            {alt.type}
                          </Badge>
                        )}
                        {alt.selected && (
                          <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 h-4">
                            Selected
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {alt.saltComposition && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Beaker className="h-2.5 w-2.5" />
                            {alt.saltComposition}
                          </span>
                        )}
                        {alt.manufacturer && (
                          <span className="text-[11px] text-muted-foreground">
                            by {alt.manufacturer}
                          </span>
                        )}
                        {alt.priceEstimate && (
                          <span className="flex items-center gap-0.5 text-[11px] font-medium text-emerald-600" data-testid={`text-alt-price-${alt.id}`}>
                            <IndianRupee className="h-2.5 w-2.5" />
                            {alt.priceEstimate}
                          </span>
                        )}
                      </div>
                    </div>

                    {isDraft && !alt.selected && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => swapMutation.mutate(alt.id)}
                        disabled={swapMutation.isPending}
                        data-testid={`button-swap-${alt.id}`}
                      >
                        {swapMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ArrowRightLeft className="h-3 w-3" />
                        )}
                        Swap
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MedicineAlternativesAutoLoaderProps {
  visitId: string;
  medicines: Array<{ id: string; name: string }>;
}

export function MedicineAlternativesAutoLoader({ visitId, medicines }: MedicineAlternativesAutoLoaderProps) {
  const [triggered, setTriggered] = useState(false);

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const med of medicines) {
        try {
          const res = await apiRequest("POST", `/api/medicines/${med.id}/alternatives`);
          results.push(await res.json());
        } catch {
        }
      }
      return results;
    },
    onSuccess: () => {
      for (const med of medicines) {
        queryClient.invalidateQueries({ queryKey: ["/api/visits", visitId, "alternatives", med.id] });
      }
    },
  });

  if (!triggered && medicines.length > 0) {
    setTriggered(true);
    generateAllMutation.mutate();
  }

  return null;
}
