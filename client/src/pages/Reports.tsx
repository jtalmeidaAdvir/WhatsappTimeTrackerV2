import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { AttendanceRecord, Employee } from "@shared/schema";
import { formatDateTime, formatTime } from "@/lib/utils";
import { FileText, Download, Calendar, Users, Clock, MapPin } from "lucide-react";
import { useState } from "react";

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: records = [], isLoading: recordsLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const getEmployeeName = (record: AttendanceRecord) => {
    if (record.employee_name) {
      return record.employee_name;
    }
    return employees.find(emp => emp.id === record.employeeId)?.name || "Funcionário não encontrado";
  };

  const getDateRange = (type: string) => {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    
    switch (type) {
      case 'today':
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        return { start: startOfDay, end: endOfDay };
      
      case 'week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { start: startOfWeek, end: endOfWeek };
      
      case 'month':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start: startOfMonth, end: endOfMonth };
      
      default:
        return { start: startOfDay, end: startOfDay };
    }
  };

  const getFilteredRecords = () => {
    if (!selectedReport) return [];
    
    let filteredRecords = [...records];
    
    if (selectedReport === 'employee' && selectedEmployee && selectedEmployee !== 'all') {
      const employeeId = parseInt(selectedEmployee);
      filteredRecords = filteredRecords.filter(record => record.employeeId === employeeId);
    } else if (selectedReport !== 'employee') {
      const { start, end } = getDateRange(selectedReport);
      filteredRecords = filteredRecords.filter(record => {
        const recordDate = new Date(record.timestamp);
        return recordDate >= start && recordDate <= end;
      });
    }

    if (startDate && endDate) {
      const customStart = new Date(startDate);
      customStart.setHours(0, 0, 0, 0);
      const customEnd = new Date(endDate);
      customEnd.setHours(23, 59, 59, 999);
      
      filteredRecords = filteredRecords.filter(record => {
        const recordDate = new Date(record.timestamp);
        return recordDate >= customStart && recordDate <= customEnd;
      });
    }

    // Apply employee filter for custom reports if selected and not "all"
    if (selectedReport === 'custom' && selectedEmployee && selectedEmployee !== 'all') {
      const employeeId = parseInt(selectedEmployee);
      filteredRecords = filteredRecords.filter(record => record.employeeId === employeeId);
    }

    return filteredRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const generateQuickReport = (type: string) => {
    setSelectedReport(type);
    setSelectedEmployee(null);
  };

  const getActionBadge = (type: string) => {
    const badges = {
      entrada: { label: "Entrada", className: "bg-green-100 text-green-800" },
      saida: { label: "Saída", className: "bg-red-100 text-red-800" },
      pausa: { label: "Pausa", className: "bg-yellow-100 text-yellow-800" },
      volta: { label: "Volta", className: "bg-blue-100 text-blue-800" }
    };
    
    return badges[type as keyof typeof badges] || { label: type, className: "bg-gray-100 text-gray-800" };
  };

  const reportTitles = {
    today: "Relatório do Dia",
    week: "Relatório da Semana", 
    month: "Relatório do Mês",
    employee: "Relatório por Funcionário"
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Relatórios</h2>
              <p className="text-gray-600 mt-1">Gerar e visualizar relatórios de ponto</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Report Generation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Gerar Relatório Personalizado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Inicial
                </label>
                <Input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Final
                </label>
                <Input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Funcionário (Opcional)
                </label>
                <Select value={selectedEmployee || "all"} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar funcionário..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os funcionários</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full"
                onClick={() => {
                  setSelectedReport('custom');
                }}
                disabled={!startDate || !endDate}
              >
                <FileText className="mr-2 h-4 w-4" />
                Ver Relatório
              </Button>
            </CardContent>
          </Card>

          {/* Quick Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Relatórios Rápidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => generateQuickReport('today')}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Relatório do Dia
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => generateQuickReport('week')}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Relatório da Semana
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => generateQuickReport('month')}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Relatório do Mês
              </Button>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setSelectedReport('employee')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Relatório por Funcionário
                </Button>
                {selectedReport === 'employee' && (
                  <Select value={selectedEmployee || "all"} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar funcionário..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os funcionários</SelectItem>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id.toString()}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Results */}
        {selectedReport && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {selectedReport === 'custom' ? 'Relatório Personalizado' : 
                   selectedReport === 'employee' && selectedEmployee ? 
                   `${reportTitles[selectedReport]} - ${employees.find(e => e.id.toString() === selectedEmployee)?.name}` :
                   reportTitles[selectedReport as keyof typeof reportTitles]}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedReport(null);
                    setSelectedEmployee(null);
                  }}
                >
                  Fechar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recordsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-gray-500 mt-2">Carregando registros...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getFilteredRecords().length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Nenhum registro encontrado para este período
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                        <span>Total de registros: {getFilteredRecords().length}</span>
                      </div>
                      {getFilteredRecords().map((record) => {
                        const badge = getActionBadge(record.type);
                        return (
                          <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">
                                  {getEmployeeName(record).split(' ').map(n => n[0]).join('').toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {getEmployeeName(record)}
                                </div>
                                <div className="text-sm text-gray-500 flex items-center">
                                  {record.message}
                                  {(record.latitude || record.longitude) && (
                                    <button
                                      onClick={() => window.open(`https://www.google.com/maps?q=${record.latitude},${record.longitude}`, '_blank')}
                                      className="ml-2 flex items-center text-blue-600 hover:text-blue-800 cursor-pointer transition-colors"
                                      title={`Clique para abrir no Google Maps - Localização: ${record.latitude}, ${record.longitude}${record.address ? ` - ${record.address}` : ''}`}
                                    >
                                      <MapPin className="h-3 w-3 mr-1" />
                                      <span className="text-xs">GPS</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge className={badge.className}>
                                {badge.label}
                              </Badge>
                              <div className="text-sm text-gray-500 mt-1 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatDateTime(record.timestamp)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
