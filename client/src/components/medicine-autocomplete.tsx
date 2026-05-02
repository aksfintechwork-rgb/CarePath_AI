import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { getSessionToken } from "@/lib/queryClient";
import { Pill, Loader2, Search } from "lucide-react";

interface MedicineRef {
  name: string;
  category: string | null;
  dosageForm: string | null;
  strength: string | null;
  indication: string | null;
}

interface MedicineAutocompleteProps {
  value: string;
  onChange: (name: string) => void;
  onSelect: (med: MedicineRef) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

export function MedicineAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Type medicine name...",
  className = "",
  "data-testid": testId,
}: MedicineAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<MedicineRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);

  const updatePos = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const token = getSessionToken();
      const res = await fetch(`/api/medicine-reference/search?q=${encodeURIComponent(query)}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
        setHighlightIdx(-1);
        updatePos();
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") setSuggestions([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [updatePos]);

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  const handleSelect = (med: MedicineRef) => {
    onChange(med.name);
    onSelect(med);
    setOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        inputRef.current && !inputRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handler);
      window.addEventListener("scroll", updatePos, true);
      window.addEventListener("resize", updatePos);
    }
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) { updatePos(); setOpen(true); } }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`pl-8 ${className}`}
          autoComplete="off"
          data-testid={testId}
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-blue-500" />}
      </div>

      {open && suggestions.length > 0 && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 max-h-[280px] overflow-y-auto"
          style={{ zIndex: 99999, top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          data-testid="medicine-suggestions"
        >
          {suggestions.map((med, i) => (
            <button
              key={`${med.name}-${i}`}
              onClick={() => handleSelect(med)}
              className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors border-b border-gray-50 last:border-0 ${
                i === highlightIdx ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
              data-testid={`suggestion-med-${i}`}
            >
              <Pill className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-foreground truncate">{med.name}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {med.strength && (
                    <span className="text-xs text-blue-600 font-medium">{med.strength}</span>
                  )}
                  {med.dosageForm && (
                    <span className="text-xs text-muted-foreground">{med.dosageForm}</span>
                  )}
                  {med.category && (
                    <span className="text-xs text-emerald-600">{med.category}</span>
                  )}
                </div>
                {med.indication && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {med.indication}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
