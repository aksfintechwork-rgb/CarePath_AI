import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getSessionToken } from "@/lib/queryClient";
import {
  Newspaper,
  Sparkles,
  FlaskConical,
  HeartPulse,
  Pill,
  BookOpen,
  Cpu,
  Clock,
  Tag,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type MedicalNewsArticle = {
  id: string;
  doctorId: string;
  category: string;
  title: string;
  summary: string;
  content: string;
  source: string | null;
  imageKeyword: string | null;
  tags: string[] | null;
  publishedAt: string;
  createdAt: string;
};

const categories = [
  { id: "all", label: "All Articles", icon: Newspaper },
  { id: "latest_research", label: "Research", icon: FlaskConical },
  { id: "health_tips", label: "Health Tips", icon: HeartPulse },
  { id: "drug_updates", label: "Drug Updates", icon: Pill },
  { id: "clinical_guidelines", label: "Guidelines", icon: BookOpen },
  { id: "technology", label: "Med Tech", icon: Cpu },
];

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  latest_research: { bg: "from-violet-500/15 to-purple-500/15", text: "text-violet-700", border: "border-violet-200/50" },
  health_tips: { bg: "from-emerald-500/15 to-teal-500/15", text: "text-emerald-700", border: "border-emerald-200/50" },
  drug_updates: { bg: "from-amber-500/15 to-orange-500/15", text: "text-amber-700", border: "border-amber-200/50" },
  clinical_guidelines: { bg: "from-blue-500/15 to-cyan-500/15", text: "text-blue-700", border: "border-blue-200/50" },
  technology: { bg: "from-rose-500/15 to-pink-500/15", text: "text-rose-700", border: "border-rose-200/50" },
};

const categoryIcons: Record<string, typeof FlaskConical> = {
  latest_research: FlaskConical,
  health_tips: HeartPulse,
  drug_updates: Pill,
  clinical_guidelines: BookOpen,
  technology: Cpu,
};

function ArticleCard({ article }: { article: MedicalNewsArticle }) {
  const [expanded, setExpanded] = useState(false);
  const colors = categoryColors[article.category] || categoryColors.latest_research;
  const IconComp = categoryIcons[article.category] || FlaskConical;

  return (
    <div className="glass-card p-6 hover:shadow-lg transition-all duration-300 group" data-testid={`card-article-${article.id}`}>
      <div className="flex items-start gap-4">
        <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${colors.bg} flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
          <IconComp className={`h-6 w-6 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge className={`bg-gradient-to-r ${colors.bg} ${colors.text} ${colors.border} shadow-none text-xs`}>
              {categories.find(c => c.id === article.category)?.label || article.category}
            </Badge>
            {article.source && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {article.source}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-foreground text-lg leading-snug mb-2 group-hover:text-blue-700 transition-colors" data-testid={`text-article-title-${article.id}`}>
            {article.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3" data-testid={`text-article-summary-${article.id}`}>
            {article.summary}
          </p>

          {expanded && (
            <div className="prose prose-sm max-w-none text-foreground/80 mb-4 animate-in fade-in slide-in-from-top-2 duration-300" data-testid={`text-article-content-${article.id}`}>
              {article.content.split("\n\n").map((paragraph, i) => (
                <p key={i} className="mb-3 leading-relaxed text-sm">{paragraph}</p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {article.tags?.slice(0, 4).map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-white/60 rounded-full px-2 py-0.5 border border-white/80">
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => setExpanded(!expanded)}
                data-testid={`button-expand-${article.id}`}
              >
                {expanded ? (
                  <>Read less <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Read more <ChevronDown className="h-3 w-3" /></>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass-card p-6">
          <div className="flex gap-4">
            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NewsFeedPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const { toast } = useToast();

  const { data: articles = [], isLoading } = useQuery<MedicalNewsArticle[]>({
    queryKey: ["/api/news", activeCategory],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/news?category=${activeCategory}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (category: string) => {
      const token = getSessionToken();
      const res = await fetch("/api/news/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ category: category === "all" ? "latest_research" : category }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({ title: "New articles generated", description: "Fresh medical insights personalized for your specialty." });
    },
    onError: () => {
      toast({ title: "Generation failed", description: "Could not generate articles. Please try again.", variant: "destructive" });
    },
  });

  const filteredArticles = articles;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Newspaper className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Medical News Feed</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[52px]">
            Personalized medical research and health insights for your specialty
          </p>
        </div>
        <Button
          onClick={() => generateMutation.mutate(activeCategory)}
          disabled={generateMutation.isPending}
          className="bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
          data-testid="button-generate-news"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {generateMutation.isPending ? "Generating..." : "Generate New Articles"}
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-violet-500/15 to-purple-500/15 text-violet-700 border border-violet-200/50 shadow-sm"
                  : "bg-white/40 text-muted-foreground hover:bg-white/60 hover:text-foreground border border-transparent"
              }`}
              data-testid={`button-category-${cat.id}`}
            >
              <cat.icon className="h-4 w-4" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {generateMutation.isPending && (
        <div className="glass-card-strong p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 text-violet-600 animate-spin" />
            </div>
            <div>
              <p className="font-medium text-foreground">Generating personalized articles...</p>
              <p className="text-sm text-muted-foreground mt-1">AI is curating the latest medical insights based on your specialty</p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : filteredArticles.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center">
              <Newspaper className="h-8 w-8 text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg mb-1">No articles yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Click "Generate New Articles" to get personalized medical research and health tips curated by AI for your specialty.
              </p>
            </div>
            <Button
              onClick={() => generateMutation.mutate(activeCategory)}
              disabled={generateMutation.isPending}
              className="bg-gradient-to-r from-violet-600 to-purple-600 text-white mt-2"
              data-testid="button-generate-first"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Your First Articles
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      <div className="glass-card p-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filteredArticles.length} article{filteredArticles.length !== 1 ? "s" : ""} in your feed</span>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Powered by AI, personalized for your specialty
          </span>
        </div>
      </div>
    </div>
  );
}
