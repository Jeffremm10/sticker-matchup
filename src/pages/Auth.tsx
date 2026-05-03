import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

export default function Auth() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    nav("/");
  };

  const signUp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to confirm.");
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Google sign-in failed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary via-primary-glow to-secondary">
      <Card className="w-full max-w-md p-6 shadow-2xl">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Trophy className="text-accent" />
          </div>
          <h1 className="text-2xl font-black">Sticker Swapper 2026</h1>
          <p className="text-xs text-muted-foreground">Trade The 26 Collection</p>
        </div>
        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="space-y-3 pt-4">
            <div><Label>Email</Label><Input value={email} onChange={e=>setEmail(e.target.value)} type="email"/></div>
            <div><Label>Password</Label><Input value={password} onChange={e=>setPassword(e.target.value)} type="password"/></div>
            <Button className="w-full" onClick={signIn} disabled={busy}>Sign In</Button>
          </TabsContent>
          <TabsContent value="signup" className="space-y-3 pt-4">
            <div><Label>Display Name</Label><Input value={name} onChange={e=>setName(e.target.value)}/></div>
            <div><Label>Email</Label><Input value={email} onChange={e=>setEmail(e.target.value)} type="email"/></div>
            <div><Label>Password</Label><Input value={password} onChange={e=>setPassword(e.target.value)} type="password"/></div>
            <Button className="w-full" onClick={signUp} disabled={busy}>Create Account</Button>
          </TabsContent>
        </Tabs>
        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border"/>or<div className="flex-1 h-px bg-border"/>
        </div>
        <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
      </Card>
    </div>
  );
}