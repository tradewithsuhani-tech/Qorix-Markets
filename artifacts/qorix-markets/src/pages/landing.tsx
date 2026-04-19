import { useState } from "react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { TrendingUp, Lock, Mail, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  
  const { login: setAuthData } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setAuthData(data.token, data.user);
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast({ title: "Login failed", description: err.message || "Invalid credentials", variant: "destructive" });
      }
    }
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        setAuthData(data.token, data.user);
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast({ title: "Registration failed", description: err.message || "Something went wrong", variant: "destructive" });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      loginMutation.mutate({ data: { email, password } });
    } else {
      registerMutation.mutate({ data: { email, password, fullName, referralCode: referralCode || undefined } });
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col md:flex-row">
      <div className="flex-1 flex flex-col justify-center p-8 md:p-12 lg:p-24 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-background to-background -z-10" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full mx-auto space-y-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tighter text-white">
              Qorix<span className="text-primary font-light">Markets</span>
            </h1>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight">
              {isLogin ? "Welcome back" : "Start your journey"}
            </h2>
            <p className="text-muted-foreground text-lg">
              {isLogin ? "Enter your credentials to access your terminal." : "Create an account to start automated trading."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <input 
                    type="text"
                    required
                    placeholder="Full Name" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <input 
                  type="email"
                  required
                  placeholder="Email Address" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <input 
                  type="password"
                  required
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Referral Code (Optional)" 
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
              </div>
            )}

            <button 
              type="submit"
              disabled={loginMutation.isPending || registerMutation.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg transition-colors shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:shadow-[0_0_25px_rgba(59,130,246,0.6)] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-muted-foreground">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button" 
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? "Register now" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>
      
      <div className="hidden md:flex flex-1 bg-black relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        
        <div className="relative z-10 max-w-lg p-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Professional Automated USDT Trading</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Experience institutional-grade algorithms, real-time analytics, and automated wealth generation in one secure platform.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4 rounded-xl">
              <div className="text-primary font-bold text-2xl mb-1">Up to 10%</div>
              <div className="text-sm text-muted-foreground">Daily Returns</div>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="text-primary font-bold text-2xl mb-1">100%</div>
              <div className="text-sm text-muted-foreground">Automated</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
