import { useLocation } from "wouter";
import { AlertCircle, ArrowLeft, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="h-20 w-20 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
        <AlertCircle className="h-10 w-10 text-red-400" />
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-404-title">Page Not Found</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button
        onClick={() => setLocation("/")}
        className="gap-2"
        data-testid="button-go-home"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>
    </div>
  );
}
