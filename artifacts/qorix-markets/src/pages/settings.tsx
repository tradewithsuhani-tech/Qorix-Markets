import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { User as UserIcon, Mail, Calendar, Shield } from "lucide-react";
import { format } from "date-fns";

export default function SettingsPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-muted-foreground">Manage your profile and preferences.</p>
        </div>

        <div className="glass-card p-8 rounded-xl space-y-6">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl border border-primary/30">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{user.fullName}</h2>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" /> {user.email}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <UserIcon className="w-4 h-4" /> Account ID
              </label>
              <div className="font-mono text-lg bg-black/30 px-3 py-2 rounded-lg border border-white/5">
                QORIX-{user.id.toString().padStart(6, '0')}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Member Since
              </label>
              <div className="font-medium text-lg bg-black/30 px-3 py-2 rounded-lg border border-white/5">
                {format(new Date(user.createdAt), "MMMM dd, yyyy")}
              </div>
            </div>
          </div>

          <div className="pt-4 space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Security
            </h3>
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
              <div>
                <div className="font-medium">Password</div>
                <div className="text-sm text-muted-foreground">Last changed: Never</div>
              </div>
              <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm font-medium transition-colors">
                Update
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}