import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { AIResponseViewer } from "@/components/ai-response-viewer";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, User, Send, Sparkles, RefreshCw, ShieldAlert,
  Stethoscope, Biohazard, Activity, Lightbulb, Copy, Check
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  source?: string;
}

const SUGGESTED_PROMPTS = [
  "What is the Surviving Sepsis 1-Hour Bundle protocol?",
  "How to treat MRSA bacteremia according to ICMR guidelines?",
  "What antibiotic combination is recommended for NDM CRE isolates?",
  "How to interpret Procalcitonin and CRP elevation in ICU patients?",
  "What are the dosage guidelines for Colistin loading and maintenance?",
  "What are the criteria for WHO AWaRe Reserve antibiotics?"
];

export default function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "### Aarogya X — AI Clinical Decision Support Assistant\n\nWelcome! I am your **AI Clinical Assistant**, trained on antimicrobial resistance (AMR), pharmacovigilance (ADR), and evidence-based clinical protocols (ICMR, IDSA/ATS, WHO AWaRe, PvPI).\n\n#### How Can I Assist You Today?\n- **Antibiotic Selection & Dosing:** Empiric and culture-directed regimens\n- **Resistant Pathogen Protocols:** MRSA, CRE/NDM, ESBL, MDR Pseudomonas, Acinetobacter\n- **Critical Care & Sepsis:** Surviving Sepsis 1-hour bundle & vasopressor support\n- **Biomarker Interpretation:** Procalcitonin (PCT), CRP, and Lactate clearance\n- **Pharmacovigilance (ADR):** Causality assessment and adverse event reporting",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: "Aarogya X Clinical Knowledge Base"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input.trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInput("");
    setLoading(true);

    try {
      const token = localStorage.getItem("aarogya_token");
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query: textToSend })
      });

      if (!res.ok) {
        throw new Error("Failed to communicate with Clinical AI backend");
      }

      const data = await res.json();
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data.response || "No response received from clinical decision engine.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: data.source || "Aarogya X Clinical AI Engine"
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      toast({
        title: "AI Response Failed",
        description: err?.message || "Could not generate clinical recommendation",
        variant: "destructive"
      });
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: "⚠️ **Service Error:** Unable to reach Clinical Decision Support server. Please verify your connection or try asking again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "AI Clinical Assistant" }]} />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-5 rounded-xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Aarogya X Clinical AI Assistant
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  <Sparkles className="h-3 w-3 mr-1" /> Active Decision Support
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Evidence-based AMR stewardship, dosing protocols, and infection guidelines
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setMessages([messages[0]]);
            toast({ title: "Chat conversation cleared" });
          }}
          className="text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset Conversation
        </Button>
      </div>

      {/* Suggested Prompts */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Clinical Inquiry Quick Prompts:
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="text-xs px-3 py-1.5 rounded-lg bg-muted/30 border border-border hover:border-primary/40 hover:bg-primary/5 text-foreground transition-all cursor-pointer text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Interface */}
      <Card className="border border-border shadow-xs flex flex-col h-[600px]">
        <CardContent className="p-4 flex-1 flex flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "ai" && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div className={`max-w-[85%] rounded-xl p-4 text-xs space-y-2 ${
                  msg.sender === "user"
                    ? "bg-primary text-primary-foreground font-medium rounded-tr-none"
                    : "bg-card dark:bg-muted/20 border border-border text-foreground rounded-tl-none shadow-xs"
                }`}>
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5 mb-2 text-[10px] text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wider text-primary">
                      {msg.sender === "user" ? "Clinician Query" : "Aarogya X AI Engine"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{msg.timestamp}</span>
                      {msg.sender === "ai" && (
                        <button
                          onClick={() => copyToClipboard(msg.text, msg.id)}
                          className="hover:text-primary transition-colors cursor-pointer"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {msg.sender === "ai" ? (
                    <AIResponseViewer content={msg.text} />
                  ) : (
                    <div className="text-xs text-primary-foreground whitespace-pre-line leading-relaxed">
                      {msg.text}
                    </div>
                  )}

                  {msg.source && (
                    <div className="mt-2 pt-2 border-t border-border/30 text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>Source: {msg.source}</span>
                    </div>
                  )}
                </div>

                {msg.sender === "user" && (
                  <div className="h-8 w-8 rounded-full bg-accent border border-border flex items-center justify-center text-foreground shrink-0 mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start items-center text-xs text-muted-foreground">
                <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0 animate-pulse">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="p-3 bg-muted/20 rounded-xl border border-border flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
                  <span>Synthesizing structured evidence-based clinical recommendation...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Controls */}
          <div className="mt-4 pt-3 border-t border-border flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask about antibiotics, pathogen resistance, dosing, or guidelines (e.g., 'CRE treatment protocol')..."
              className="flex-1 text-xs"
              disabled={loading}
            />
            <Button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="gap-1.5 text-xs font-bold px-4"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
