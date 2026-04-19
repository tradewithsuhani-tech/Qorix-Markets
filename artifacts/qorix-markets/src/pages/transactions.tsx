import { useGetTransactions } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Clock, CheckCircle2, XCircle } from "lucide-react";

export default function TransactionsPage() {
  const { data: transactionsData, isLoading } = useGetTransactions({ limit: 50 });
  const transactions = transactionsData?.data || [];

  const getIcon = (type: string) => {
    switch(type) {
      case 'DEPOSIT': return <ArrowDownRight className="w-5 h-5 text-green-500" />;
      case 'WITHDRAWAL': return <ArrowUpRight className="w-5 h-5 text-red-500" />;
      case 'TRANSFER': return <ArrowRightLeft className="w-5 h-5 text-blue-500" />;
      default: return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'COMPLETED': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'PENDING': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'FAILED':
      case 'REJECTED': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">History of all your deposits, withdrawals, and transfers.</p>
        </div>

        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Type</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Amount</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Date</th>
                  <th className="px-6 py-4 font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No transactions found.</td></tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded bg-white/5">
                            {getIcon(tx.type)}
                          </div>
                          <span className="font-medium capitalize">{tx.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold font-mono">
                        ${tx.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(tx.status)}
                          <span className="text-xs font-medium capitalize">{tx.status.toLowerCase()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {format(new Date(tx.createdAt), "MMM dd, yyyy HH:mm")}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs truncate max-w-[200px]">
                        {tx.description || "-"}
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