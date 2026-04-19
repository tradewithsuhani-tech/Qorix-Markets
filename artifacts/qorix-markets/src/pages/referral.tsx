import { useGetReferral, useGetReferredUsers } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { motion } from "framer-motion";
import { Copy, Users, DollarSign, Award, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ReferralPage() {
  const { data: referral, isLoading } = useGetReferral();
  const { data: users, isLoading: usersLoading } = useGetReferredUsers();
  const { toast } = useToast();

  const handleCopy = () => {
    if (referral?.referralCode) {
      navigator.clipboard.writeText(referral.referralCode);
      toast({ title: "Copied!", description: "Referral code copied to clipboard." });
    }
  };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partner Program</h1>
          <p className="text-muted-foreground">Earn commissions by inviting others to Qorix Markets.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-muted-foreground font-medium mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" /> Total Referrals
              </h3>
              <div className="text-3xl font-bold">
                {isLoading ? "..." : <AnimatedCounter value={referral?.totalReferred || 0} decimals={0} />}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{referral?.activeReferrals || 0} active</p>
            </div>
            
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-muted-foreground font-medium mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Total Earned
              </h3>
              <div className="text-3xl font-bold profit-text">
                {isLoading ? "..." : <AnimatedCounter value={referral?.totalEarned || 0} prefix="$" />}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Paid to profit balance</p>
            </div>
          </div>

          <div className="glass-card-glow p-6 rounded-xl bg-primary/5 border-primary/20">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" /> Your Invite Code
            </h3>
            <p className="text-sm text-muted-foreground mb-4">Share this code to earn 5% of your referrals' profits.</p>
            
            <div className="flex bg-black/50 rounded-lg p-1 border border-white/10 items-center">
              <div className="flex-1 px-4 font-mono font-bold tracking-wider text-lg">
                {isLoading ? "..." : referral?.referralCode}
              </div>
              <button 
                onClick={handleCopy}
                className="p-3 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl overflow-hidden mt-8">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-bold">Your Network</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-medium text-muted-foreground">User</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Invested</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {usersLoading ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : (!users || users.length === 0) ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No referrals yet. Share your code to start earning.</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium">{u.fullName}</div>
                        <div className="text-xs text-muted-foreground">{u.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")}</div>
                      </td>
                      <td className="px-6 py-4">
                        {u.isActive ? (
                          <span className="flex items-center gap-1.5 text-green-500 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active Trading
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs font-medium">Inactive</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-medium">
                        ${u.investmentAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">
                        {format(new Date(u.joinedAt), "MMM dd, yyyy")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </motion.div>
    </Layout>
  );
}