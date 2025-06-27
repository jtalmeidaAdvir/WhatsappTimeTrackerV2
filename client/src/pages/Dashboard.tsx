import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { StatsCard } from "@/components/StatsCard";
import { EmployeeTable } from "@/components/EmployeeTable";
import { WhatsAppCommands } from "@/components/WhatsAppCommands";
import { RecentMessages } from "@/components/RecentMessages";
import { QuickActions } from "@/components/QuickActions";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle, Pause, MessageSquare, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";

interface Stats {
  activeEmployees: number;
  presentToday: number;
  onBreak: number;
  messagesProcessed: number;
}

export default function Dashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [nextUpdate, setNextUpdate] = useState(60);

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Auto-refresh every minute with countdown
  useEffect(() => {
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setNextUpdate(prev => {
        if (prev <= 1) {
          return 60; // Reset to 60 seconds
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-refresh every minute
    const refreshInterval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/messages"] });
      setLastUpdate(new Date());
      setNextUpdate(60); // Reset countdown
    }, 60000);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(refreshInterval);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/employees/status"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/messages"] })
      ]);
      setLastUpdate(new Date());
      setNextUpdate(60); // Reset countdown after manual refresh
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Painel de Controlo</h2>
              <p className="text-gray-600 mt-1">Visão geral do controlo de ponto</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Manual Refresh Button */}
              <Button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </Button>
              
              {/* WhatsApp Status */}
              <div className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="font-medium">WhatsApp Conectado</span>
              </div>
              
              {/* Auto-refresh status */}
              <div className="text-sm text-gray-500 text-right">
                <div className="text-xs">Última atualização:</div>
                <div className="font-medium">{formatDateTime(lastUpdate)}</div>
                <div className="text-xs text-blue-600">
                  Próxima em {nextUpdate}s
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Funcionários Ativos"
            value={statsLoading ? "..." : stats?.activeEmployees || 0}
            icon={Users}
            change="+2 esta semana"
            changeType="positive"
            bgColor="bg-primary"
          />
          <StatsCard
            title="Presentes Hoje"
            value={statsLoading ? "..." : stats?.presentToday || 0}
            icon={CheckCircle}
            subtitle={`${stats?.presentToday || 0}/${stats?.activeEmployees || 0} funcionários`}
            bgColor="bg-green-500"
          />
          <StatsCard
            title="Em Pausa"
            value={statsLoading ? "..." : stats?.onBreak || 0}
            icon={Pause}
            subtitle="Tempo médio: 25min"
            bgColor="bg-yellow-500"
          />
          <StatsCard
            title="Mensagens Hoje"
            value={statsLoading ? "..." : stats?.messagesProcessed || 0}
            icon={MessageSquare}
            change="+12% vs ontem"
            changeType="positive"
            bgColor="bg-purple-500"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Employee Status Table */}
          <div className="lg:col-span-2">
            <EmployeeTable />
          </div>

          {/* Right Sidebar Content */}
          <div className="space-y-6">
            <WhatsAppCommands />
            <RecentMessages />
            <QuickActions />
          </div>
        </div>
      </main>
    </div>
  );
}
