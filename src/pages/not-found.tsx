import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardContent className="pt-8 pb-8 px-6 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-6 border border-destructive/20">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-1">
            Error 404
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Page Not Found
          </h1>

          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            The requested page does not exist or has been relocated.
          </p>

          <div className="flex items-center gap-3 w-full justify-center">
            <Button variant="outline" asChild className="gap-2">
              <a href="javascript:history.back()">
                <ArrowLeft className="w-4 h-4" /> Go Back
              </a>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/">
                <Home className="w-4 h-4" /> Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
