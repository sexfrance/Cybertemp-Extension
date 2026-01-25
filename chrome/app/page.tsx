"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Copy,
  RefreshCw,
  Settings,
  Mail,
  Trash2,
  ExternalLink,
  Shuffle,
  Zap,
  LogOut,
  Shield,
  Crown,
  UserPlus,
  ArrowLeft,
  Lock,
  LogIn,
  X,
  LifeBuoy,
  Moon,
  Sun,
  Keyboard,
  MousePointer2,
  Palette,
  Timer
} from "lucide-react";
import { cn } from "@/lib/utils";
import AnimatedBackground from "@/components/animated-background";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Types
type Email = {
  id: string;
  from: string; 
  to: string;
  subject: string;
  text: string;
  html?: string;
  date: string;
  read: boolean;
  // Legacy optional for safety
  from_name?: string;
  from_address?: string;
  body_text?: string;
  created_at?: string;
};

export default function Popup() {
  const [showManualKeyInput, setShowManualKeyInput] = useState(false);
  const [manualKey, setManualKey] = useState("");
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"home" | "settings">("home");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [enableDetection, setEnableDetection] = useState(true);
  const [enableAutofill, setEnableAutofill] = useState(true);
  const [plan, setPlan] = useState<{ type: string; isActive: boolean }>({ type: "FREE", isActive: false });
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastManualRefreshTime, setLastManualRefreshTime] = useState<number>(Date.now());
  
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>("");

  // Sync theme to root element
  useEffect(() => {
     if (typeof document !== "undefined") {
         const root = document.documentElement;
         root.classList.remove("light", "dark");
         root.classList.add(theme);
     }
  }, [theme]);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      // 1. Initial State Fetch
      chrome.runtime.sendMessage({ type: "GET_CURRENT_EMAIL" }, (response) => {
        if (response?.email) {
          setCurrentEmail(response.email);
          fetchEmails();
        }
      });
      
      // Request updated user stats/plan on load
      chrome.runtime.sendMessage({ type: "FETCH_USER_STATS" });

      // 2. Load Preferences & Cache
      chrome.storage.local.get([
        "apiKey", 
        "cachedEmails", 
        "enableDetection", 
        "cachedDomains", 
        "enableAutofill", 
        "plan", 
        "theme",
        "autoRefreshEnabled",
        "lastManualRefreshTime"
      ], (result: any) => {
        setApiKey(result.apiKey || "");
        if (result.cachedEmails) setEmails(result.cachedEmails);
        if (result.enableDetection !== undefined) setEnableDetection(result.enableDetection);
        if (result.enableAutofill !== undefined) setEnableAutofill(result.enableAutofill);
        if (result.plan) setPlan(result.plan);
        if (result.theme) setTheme(result.theme);
        if (result.autoRefreshEnabled !== undefined) setAutoRefreshEnabled(result.autoRefreshEnabled);
        if (result.lastManualRefreshTime) setLastManualRefreshTime(result.lastManualRefreshTime);

        if (result.cachedDomains?.length > 0) {
          setDomains(result.cachedDomains);
          setSelectedDomain(result.cachedDomains[0]);
        } else {
          chrome.runtime.sendMessage({ type: "FETCH_DOMAINS" }).catch(() => {});
        }
      });

      // 3. Listeners
      const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
        if (changes.apiKey?.newValue && changes.apiKey.newValue !== apiKey) {
            setApiKey(changes.apiKey.newValue as string);
            setTimeout(fetchEmails, 500);
            chrome.runtime.sendMessage({ type: "FETCH_USER_STATS" }); // Refetch stats on new key
        }
        const newDomains = changes.cachedDomains?.newValue as string[] | undefined;
        if (newDomains && newDomains.length > 0) {
            setDomains(newDomains);
            if (!selectedDomain) setSelectedDomain(newDomains[0]);
        }
        if (changes.cachedEmails?.newValue) {
             setEmails(changes.cachedEmails.newValue as Email[]);
        }
        if (changes.plan?.newValue) {
            setPlan(changes.plan.newValue as { type: string; isActive: boolean });
        }
        if (changes.theme?.newValue) {
            setTheme(changes.theme.newValue as "dark" | "light");
        }
      };
      
      const messageListener = (message: any) => {
          if (message.type === "EMAILS_UPDATED" && message.emails) setEmails(message.emails);
      };
      
      chrome.storage.onChanged.addListener(storageListener);
      chrome.runtime.onMessage.addListener(messageListener);

      // 4. Polling for emails while popup is open (10s interval with 30min timeout)
      const pollInterval = setInterval(() => {
          if (apiKey && currentEmail && autoRefreshEnabled) {
             // Check if 30 minutes (1800000ms) have passed since last manual refresh
             const thirtyMinutesInMs = 30 * 60 * 1000;
             const timeSinceLastRefresh = Date.now() - lastManualRefreshTime;
             
             if (timeSinceLastRefresh < thirtyMinutesInMs) {
                chrome.runtime.sendMessage({ type: "REFRESH_MAIL" });
             }
          }
      }, 10000); // 10 second interval

      return () => {
        chrome.storage.onChanged.removeListener(storageListener);
        chrome.runtime.onMessage.removeListener(messageListener);
        clearInterval(pollInterval);
      };
    }
  }, [apiKey, currentEmail, autoRefreshEnabled, lastManualRefreshTime]);

  const toggleDetection = (enabled: boolean) => {
      setEnableDetection(enabled);
      chrome.storage.local.set({ enableDetection: enabled });
  };

  const toggleAutofill = (enabled: boolean) => {
      setEnableAutofill(enabled);
      chrome.storage.local.set({ enableAutofill: enabled });
  };

  const toggleTheme = (val: boolean) => {
      const newTheme = val ? "dark" : "light";
      setTheme(newTheme);
      chrome.storage.local.set({ theme: newTheme });
  };

  const toggleAutoRefresh = (enabled: boolean) => {
      setAutoRefreshEnabled(enabled);
      chrome.storage.local.set({ autoRefreshEnabled: enabled });
  };

  const fetchEmails = () => {
    setLoading(true);
    
    // Reset the 30-minute timer on manual refresh
    const now = Date.now();
    setLastManualRefreshTime(now);
    
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.storage.local.set({ lastManualRefreshTime: now });
      chrome.runtime.sendMessage({ type: "REFRESH_MAIL" });
      setTimeout(() => setLoading(false), 2000); 
    } else {
        setTimeout(() => setLoading(false), 1000);
    }
  };

  const deleteEmail = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const updatedEmails = emails.filter(email => email.id !== id);
      setEmails(updatedEmails);
      
      if (typeof chrome !== "undefined") {
          chrome.storage.local.set({ cachedEmails: updatedEmails });
      }
      toast.success("Message deleted");
  };

  const clearInbox = () => {
      setEmails([]);
      if (typeof chrome !== "undefined") {
          chrome.storage.local.set({ cachedEmails: [] });
      }
      toast.success("Inbox cleared");
  };

  const terminateIdentity = (e?: React.MouseEvent) => {
      if(e) e.stopPropagation();
      setCurrentEmail(null);
      setEmails([]);
      if (typeof chrome !== "undefined") {
          chrome.storage.local.set({ currentEmail: null, cachedEmails: [] });
          chrome.runtime.sendMessage({ type: "TERMINATE_SESSION" });
      }
      toast.success("Identity terminated");
  };

  const generateEmail = (random: boolean = true, specificUser?: string, specificDomain?: string) => {
    const userToUse = specificUser !== undefined ? specificUser : username;
    const domainToUse = specificDomain !== undefined ? specificDomain : selectedDomain;

    if (!random && !userToUse) return;

    setLoading(true);
    if (typeof chrome !== "undefined" && chrome.runtime) {
      let finalUsername = userToUse;
      let finalDomain = domainToUse;

      if (random) {
          if (domains.length > 0) finalDomain = domains[Math.floor(Math.random() * domains.length)];
      } else if (userToUse.includes("@")) {
          // Fallback if they managed to get an @ in somehow, but we handle this in handleUsernameChange now
          const parts = userToUse.split("@");
          finalUsername = parts[0];
          if (parts.length > 1 && parts[1]) finalDomain = parts[1];
      }

      chrome.runtime.sendMessage({
          type: "GENERATE_EMAIL",
          random,
          username: finalUsername,
          domain: finalDomain
      }, (response) => {
        setLoading(false);
        if (response?.email) {
          setCurrentEmail(response.email);
          setEmails([]);
          toast.success("Identity Created");
          
          // Update UI state to match what we just generated (if it was a paste)
          if (specificUser) setUsername(specificUser);
          if (specificDomain) {
              // If the domain isn't in our list, add it so the UI doesn't break
              if (!domains.includes(specificDomain)) {
                  setDomains(prev => [...prev, specificDomain]);
              }
              setSelectedDomain(specificDomain);
          }
        } else {
            toast.error("Generation failed");
        }
      });
    } else {
        setTimeout(() => setLoading(false), 1000);
    }
  };

  const handleUsernameChange = (value: string) => {
      // Check for paste of full email
      if (value.includes("@") && value.split("@").length === 2) {
          const parts = value.split("@");
          const userPart = parts[0];
          const domainPart = parts[1];

          if (userPart && domainPart) {
              setUsername(userPart);
              // We'll update the domain state, but more importantly pass it directly to generate
              // to ensure immediate execution without waiting for React state batching
              generateEmail(false, userPart, domainPart);
              return;
          }
      }
      setUsername(value);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const saveSettings = () => {
      if (typeof chrome !== "undefined") {
          chrome.storage.local.set({ apiKey }, () => {
              toast.success("Saved");
              setView("home");
          });
      }
  };

  if (apiKey === "" && !loading) {
      return (
        <div className={cn("w-[400px] h-[600px] text-foreground flex flex-col font-sans relative overflow-hidden rounded-xl bg-background border border-border/50 shadow-2xl", theme)}>
             <AnimatedBackground />
             <div className="flex-1 flex flex-col items-center justify-center relative z-20 p-8 space-y-6 text-center">
                 <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center backdrop-blur-sm shadow-xl ring-1 ring-white/5">
                     <Lock className="w-7 h-7 text-primary" />
                 </div>
                 <div className="space-y-1">
                     <h1 className="text-xl font-bold tracking-tight">Access Required</h1>
                     <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">Please login to access your disposable identities.</p>
                 </div>
                 <div className="grid gap-3 w-full max-w-[240px]">
                     <Button size="sm" className="w-full font-bold shadow-lg shadow-primary/20 h-10 text-sm" onClick={() => window.open(`https://cybertemp.xyz/auth/login?source=extension`, "_blank")}>
                         <LogIn className="w-4 h-4 mr-2" /> Login via Website
                     </Button>
                 </div>
                 <div className="pt-2">
                     <p className="text-xs text-muted-foreground uppercase tracking-widest cursor-pointer hover:text-primary transition-colors" onClick={() => setShowManualKeyInput(!showManualKeyInput)}>
                        {showManualKeyInput ? "Hide Input" : "Manual API Key"}
                     </p>
                     {showManualKeyInput && (
                         <div className="mt-3 flex gap-2 animate-in slide-in-from-bottom-2">
                             <Input type="password" placeholder="sk_..." value={manualKey} onChange={(e) => setManualKey(e.target.value)} className="flex-1 h-9 text-xs" />
                             <Button size="sm" onClick={() => { if(manualKey) { setApiKey(manualKey); chrome.storage.local.set({ apiKey: manualKey }); }}} disabled={!manualKey} className="h-9 px-3 text-xs">Save</Button>
                         </div>
                     )}
                 </div>
             </div>
        </div>
      );
  }

  if (apiKey === null) return <div className={cn("w-[400px] h-[600px] bg-background flex items-center justify-center", theme)}><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <TooltipProvider>
    <div className="w-[400px] h-[600px] text-foreground flex flex-col font-sans relative overflow-hidden rounded-xl bg-background border border-border/50 shadow-2xl select-none">
      <AnimatedBackground />
      <div className="flex-1 flex flex-col relative z-20 h-full">
          
          <header className="px-6 py-5 flex items-center justify-between bg-background/80 backdrop-blur-xl border-b border-black/5 dark:border-white/5 shrink-0 z-50 transition-colors">
            <div className="flex items-center gap-3">
               <div className="relative group">
                   <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-primary shadow-sm">
                       <Mail className="w-5 h-5" />
                   </div>
               </div>
                <div className="flex flex-col">
                   <span className="font-bold text-lg tracking-tight text-foreground/95">CyberTemp</span>
                   <span className="text-xs text-muted-foreground/80 uppercase tracking-widest font-semibold">Extension</span>
                </div>
             </div>
             <div className="flex items-center gap-1">
                 <Button variant="ghost" size="icon" className="hover:bg-black/5 dark:hover:bg-white/5 rounded-lg w-9 h-9" onClick={() => toggleTheme(theme === "light")}>
                    {theme === "dark" ? <Moon className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" /> : <Sun className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />}
                 </Button>
                 <Button variant="ghost" size="icon" className="hover:bg-black/5 dark:hover:bg-white/5 rounded-lg w-9 h-9" onClick={() => setView(view === "home" ? "settings" : "home")}>
                   <Settings className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                 </Button>
             </div>
           </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); }
            `}</style>
            
            {view === "home" ? (
              selectedEmail ? (
                // DETAIL VIEW
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-300">
                    <div className="flex items-center gap-2.5 mb-5 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedEmail(null)} className="h-9 w-9 -ml-1 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-full">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h2 className="text-base font-bold truncate flex-1 text-foreground">{selectedEmail.subject || "No Subject"}</h2>
                        <Button variant="ghost" size="icon" onClick={(e) => { deleteEmail(e, selectedEmail.id); setSelectedEmail(null); }} className="h-9 w-9 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-full">
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar">
                        <div className="bg-card/60 border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-3 backdrop-blur-md shadow-sm">
                            <div className="flex justify-between items-start gap-4">
                                <span className="text-base font-bold text-foreground block truncate">{selectedEmail.from || "Unknown Sender"}</span>
                                <span className="text-xs text-muted-foreground/80 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded font-medium shrink-0">
                                    {selectedEmail.date ? new Date(selectedEmail.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                                </span>
                            </div>
                        </div>
                        <div className="bg-card/40 border border-black/5 dark:border-white/5 rounded-xl p-6 min-h-[300px] text-sm leading-relaxed whitespace-pre-wrap font-sans text-muted-foreground/90 selection:bg-primary/20">
                            {selectedEmail.text || selectedEmail.body_text || "No content"}
                        </div>
                    </div>
                </div>
              ) : (
                // LIST VIEW
                <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-left-8 duration-300">
                    {/* Active Identity - Unified Look (No separate Card for generated emails) */}
                    <div>
                          {!currentEmail ? (
                              <Card className="border-border/40 bg-card/40 shadow-sm overflow-hidden backdrop-blur-sm">
                                <CardContent className="p-4 space-y-4">
                                  <div className="flex items-center gap-3">
                                       <div className="relative flex-1">
                                           <Input 
                                              placeholder="username (opt)" 
                                              value={username} 
                                              onChange={(e) => handleUsernameChange(e.target.value)}
                                              className="h-10 text-sm bg-white/60 dark:bg-[#07060B]/50 backdrop-blur-md border-border/40 focus:border-primary/50 pr-9 placeholder:text-muted-foreground/50 shadow-sm" 
                                              maxLength={80}
                                          />
                                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none">
                                              <UserPlus className="w-4 h-4" />
                                          </div>
                                       </div>
                                       <div className="relative w-[140px]">
                                          <Select value={selectedDomain} onValueChange={setSelectedDomain} disabled={domains.length === 0}>
                                              <SelectTrigger className="h-10 text-sm bg-white/60 dark:bg-[#07060B]/50 backdrop-blur-md border-border/40 focus:ring-0 focus:border-primary/50 shadow-sm">
                                                  <SelectValue placeholder={domains.length > 0 ? "Select Domain" : "Loading..."} />
                                              </SelectTrigger>
                                              <SelectContent position="popper" sideOffset={4} className="max-h-[200px] select-content-scroll">
                                                  {domains.map((domain) => (
                                                      <SelectItem key={domain} value={domain} className="text-sm cursor-pointer">{domain}</SelectItem>
                                                  ))}
                                              </SelectContent>
                                          </Select>
                                       </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                      <Button 
                                          variant="outline" 
                                          className="h-10 text-sm font-semibold hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all"
                                          onClick={() => generateEmail(true)}
                                          disabled={loading || domains.length === 0}
                                      >
                                          <Shuffle className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                                          Random
                                      </Button>
                                      <Button 
                                          className="h-10 text-sm font-bold shadow-md shadow-primary/10"
                                          onClick={() => generateEmail(false)}
                                          disabled={loading || !username || domains.length === 0}
                                      >
                                          <Zap className={cn("w-4 h-4 mr-2", loading && "animate-pulse")} />
                                          Create
                                      </Button>
                                  </div>
                                </CardContent>
                              </Card>
                          ) : (
                              <div className="flex flex-col items-center justify-center py-1 space-y-4">
                                  <div className="relative group w-full flex items-center gap-2">
                                      <div className="flex-1 flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-white/60 dark:bg-[#07060B]/50 backdrop-blur-md border border-border/40 hover:border-primary/40 transition-all cursor-pointer shadow-lg shadow-black/5" onClick={() => copyToClipboard(currentEmail)}>
                                          <div className="flex items-center gap-3.5 overflow-hidden">
                                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                  <Mail className="w-5 h-5 text-primary" />
                                              </div>
                                              <div className="flex flex-col items-start min-w-0 space-y-0.5">
                                                  <span className="text-sm font-bold text-foreground truncate w-full">{currentEmail}</span>
                                                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                      Active Session
                                                  </span>
                                              </div>
                                          </div>
                                          <Copy className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors shrink-0" />
                                      </div>
                                      
                                      <Tooltip>
                                          <TooltipTrigger asChild>
                                              <Button 
                                                  variant="ghost" 
                                                  size="icon"
                                                  className="h-12 w-12 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-red-400 shrink-0"
                                                  onClick={terminateIdentity}
                                              >
                                                  <Trash2 className="w-5 h-5" />
                                              </Button>
                                          </TooltipTrigger>
                                          <TooltipContent><p>Terminate Identity</p></TooltipContent>
                                      </Tooltip>
                                  </div>
                              </div>
                          )}
                    </div>
   
                    {/* Inbox Section */}
                    <div className="flex-1 overflow-hidden flex flex-col space-y-3">
                        <div className="flex items-center justify-between px-1 pt-1 border-t border-black/5 dark:border-white/5 mt-2 transition-colors">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mt-4 ml-1">
                                <Shield className="w-3.5 h-3.5 text-primary/60" />
                                Inbox
                            </h3>
                            <div className="flex items-center gap-1 mt-4">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        clearInbox();
                                    }}
                                    disabled={emails.length === 0}
                                    title="Clear Inbox"
                                >
                                   <Trash2 className="w-4 h-4" />
                                </Button>
  
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-md transition-colors" 
                                    onClick={fetchEmails}
                                    title="Refresh"
                                >
                                     <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-primary")} />
                                </Button>
                            </div>
                        </div>
   
                        <div className="space-y-2.5 pb-2 min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1">
                        {emails.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 opacity-60">
                                <div className="w-14 h-14 rounded-full bg-accent/50 flex items-center justify-center mb-1 ring-1 ring-border/50">
                                    <Mail className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-base font-medium text-foreground">No messages</p>
                                    <p className="text-xs text-muted-foreground">Waiting for incoming emails...</p>
                                </div>
                            </div>
                        ) : (
                            emails.map((email) => (
                                <div 
                                  key={email.id}
                                  className="group relative rounded-xl border border-border/40 bg-white/60 dark:bg-[#07060B]/50 backdrop-blur-md hover:bg-white/80 dark:hover:bg-[#07060B]/70 hover:border-primary/30 transition-all cursor-pointer overflow-hidden p-3 shadow-sm"
                                  onClick={() => setSelectedEmail(email)}
                                >
                                    <div className="flex justify-between items-start mb-0.5">
                                        <div className="flex items-center gap-2.5 max-w-[80%]">
                                            <div className="w-2 h-2 rounded-full bg-primary shrink-0 glow-sm"></div>
                                            <span className="font-bold text-sm truncate text-foreground/90 group-hover:text-primary transition-colors">
                                                {email.from || "Unknown Sender"}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-mono opacity-50">
                                           {email.date ? new Date(email.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                                        </span>
                                    </div>
                                    <h4 className="text-xs font-semibold text-foreground/80 mb-0.5 truncate pr-8">{email.subject || "No Subject"}</h4>
                                    <p className="text-[11px] text-muted-foreground/60 line-clamp-1">{email.text || "No preview available"}</p>
                                    
                                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button 
                                           variant="ghost" 
                                           size="icon" 
                                           className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md"
                                           onClick={(e) => deleteEmail(e, email.id)}
                                       >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                        </div>
                    </div>
                </div>
              )
            ) : (
               <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                   <div className="flex items-center gap-3 mb-2">
                     <Button variant="ghost" size="icon" onClick={() => setView("home")} className="hover:bg-black/5 dark:hover:bg-white/5 -ml-2 rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Button>
                     <h2 className="text-base font-bold text-foreground">Settings</h2>
                   </div>
                   <div className="space-y-4">
                       <Label className="uppercase text-xs tracking-widest text-muted-foreground/70 font-bold ml-1">Account</Label>
                       <div className="rounded-xl border border-border/50 bg-card/50 p-4 flex items-center justify-between hover:bg-card/80 transition-colors shadow-sm">
                           <div className="flex items-center gap-3.5">
                               <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", plan.type === 'ELITE' ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary")}>
                                   <Crown className="w-5 h-5" />
                               </div>
                               <div>
                                   <div className="flex items-center gap-2">
                                       <span className="font-bold text-sm text-foreground capitalize">{plan.type.replace('_', ' ').toLowerCase()} Plan</span>
                                       {plan.type === 'ELITE' && <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20">PRO</Badge>}
                                   </div>
                                   <p className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                       {apiKey?.substring(0, 8)}••••••••
                                   </p>
                               </div>
                           </div>
                           <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" 
                                onClick={() => { 
                                    // Full Logout Wipe
                                    setApiKey(""); 
                                    setCurrentEmail(null);
                                    setEmails([]);
                                    setPlan({ type: "FREE", isActive: false });
                                    if (typeof chrome !== "undefined") {
                                        chrome.storage.local.set({ apiKey: "", currentEmail: null, cachedEmails: [], plan: null });
                                    }
                                    setView("home"); // Reset view so they don't get stuck in settings
                                }}
                            >
                               <LogOut className="w-4 h-4" />
                           </Button>
                       </div>
                   </div>
                   <div className="space-y-3">
                       <Label className="uppercase text-xs tracking-widest text-muted-foreground font-bold ml-1 mb-2 block">Preferences</Label>
                       
                       <div className="p-3 rounded-xl bg-card/50 border border-border/50 flex items-center justify-between hover:bg-card/80 transition-all group shadow-sm">
                           <div className="flex items-center gap-3">
                               <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                                   <Palette className="w-4 h-4" />
                               </div>
                               <div className="space-y-0.5">
                                   <Label className="text-sm font-medium text-foreground">Dark Mode</Label>
                                   <p className="text-[10px] text-muted-foreground">Toggle app theme</p>
                               </div>
                           </div>
                           <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} className="data-[state=checked]:bg-primary scale-90 origin-right" />
                       </div>

                       <div className="p-3 rounded-xl bg-card/50 border border-border/50 flex items-center justify-between hover:bg-card/80 transition-all group shadow-sm">
                           <div className="flex items-center gap-3">
                               <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                                   <MousePointer2 className="w-4 h-4" />
                               </div>
                               <div className="space-y-0.5">
                                   <Label className="text-sm font-medium text-foreground">Input Detection</Label>
                                   <p className="text-[10px] text-muted-foreground">Show icon on email fields</p>
                               </div>
                           </div>
                           <Switch checked={enableDetection} onCheckedChange={toggleDetection} className="data-[state=checked]:bg-primary scale-90 origin-right" />
                       </div>

                       <div className="p-3 rounded-xl bg-card/50 border border-border/50 flex items-center justify-between hover:bg-card/80 transition-all group shadow-sm">
                           <div className="flex items-center gap-3">
                               <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                                   <Keyboard className="w-4 h-4" />
                               </div>
                               <div className="space-y-0.5">
                                   <Label className="text-sm font-medium text-foreground">Autofill Verification</Label>
                                   <p className="text-[10px] text-muted-foreground">Auto-type verification codes</p>
                               </div>
                           </div>
                           <Switch checked={enableAutofill} onCheckedChange={toggleAutofill} className="data-[state=checked]:bg-primary scale-90 origin-right" />
                       </div>

                        <div className="p-3 rounded-xl bg-card/50 border border-border/50 flex items-center justify-between hover:bg-card/80 transition-all group shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                                    <Timer className="w-4 h-4" />
                                </div>
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium text-foreground">Auto-Refresh Emails</Label>
                                    <p className="text-[10px] text-muted-foreground">Check for new emails every 10s</p>
                                </div>
                            </div>
                            <Switch checked={autoRefreshEnabled} onCheckedChange={toggleAutoRefresh} className="data-[state=checked]:bg-primary scale-90 origin-right" />
                        </div>
                   </div>

                   <div className="space-y-3">
                       <Label className="uppercase text-xs tracking-widest text-muted-foreground/70 font-bold ml-1 mb-2 block">Support</Label>
                       <Button 
                            variant="outline" 
                            className="w-full justify-between h-auto py-3 px-3 bg-card/50 border-border/50 hover:bg-card hover:border-primary/20 group shadow-sm"
                            onClick={() => window.open('https://cybertemp.xyz/contact', '_blank')}
                        >
                           <div className="flex items-center gap-3">
                               <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                   <LifeBuoy className="w-4 h-4" />
                               </div>
                               <div className="flex flex-col items-start px-0.5">
                                    <span className="text-sm font-bold text-foreground">Contact Support</span>
                                    <span className="text-[10px] text-muted-foreground">Need help? Get in touch</span>
                               </div>
                           </div>
                           <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                       </Button>
                   </div>
               </div>
             )}
          </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
