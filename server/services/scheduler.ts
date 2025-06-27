import { storage } from '../storage.js';
import { whatsappService } from './whatsapp.js';

export class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];

  constructor() {
    this.initializeScheduler();
  }

  private initializeScheduler() {
    // Verificar a cada minuto se chegou a hora dos lembretes
    const checkInterval = setInterval(() => {
      this.checkReminderTimes();
    }, 60000); // 60 segundos

    this.intervals.push(checkInterval);
    console.log('📅 Sistema de lembretes automáticos iniciado');
  }

  private async checkReminderTimes() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Lembrete de entrada às 09:00
    if (hours === 9 && minutes === 0) {
      await this.sendClockInReminders();
    }
    
    // Lembrete de saída às 18:00
    if (hours === 18 && minutes === 0) {
      await this.sendClockOutReminders();
    }
  }

  private async sendClockInReminders() {
    console.log('🔔 Verificando funcionários para lembrete de entrada às 09:00');
    
    try {
      const employees = await storage.getAllEmployees();
      const activeEmployees = employees.filter(emp => emp.isActive);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (const employee of activeEmployees) {
        // Verificar se já registou entrada hoje
        const todayRecords = await storage.getAttendanceRecords(employee.id, today);
        const hasEntryToday = todayRecords.some(record => record.type === 'entrada');
        
        if (!hasEntryToday) {
          const message = `🌅 *Bom dia, ${employee.name}!*

⏰ São 09:00 e é hora de registar a tua entrada.

👉 Envia simplesmente: *entrada*

Tenha um excelente dia de trabalho! 💪`;

          await whatsappService.sendMessage(employee.phone, message);
          console.log(`📤 Lembrete de entrada enviado para ${employee.name} (${employee.phone})`);
          
          // Aguardar 2 segundos entre mensagens para evitar spam
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error('❌ Erro ao enviar lembretes de entrada:', error);
    }
  }

  private async sendClockOutReminders() {
    console.log('🔔 Verificando funcionários para lembrete de saída às 18:00');
    
    try {
      const employees = await storage.getAllEmployees();
      const activeEmployees = employees.filter(emp => emp.isActive);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (const employee of activeEmployees) {
        // Verificar registos de hoje
        const todayRecords = await storage.getAttendanceRecords(employee.id, today);
        
        const hasEntryToday = todayRecords.some(record => record.type === 'entrada');
        const hasExitToday = todayRecords.some(record => record.type === 'saida');
        
        // Só enviar lembrete se registou entrada mas não registou saída
        if (hasEntryToday && !hasExitToday) {
          const message = `🌆 *Boa tarde, ${employee.name}!*

⏰ São 18:00 e ainda não registaste a tua saída.

👉 Não te esqueças de enviar: *saida*

Se ainda estás a trabalhar, podes ignorar esta mensagem. 😊`;

          await whatsappService.sendMessage(employee.phone, message);
          console.log(`📤 Lembrete de saída enviado para ${employee.name} (${employee.phone})`);
          
          // Aguardar 2 segundos entre mensagens para evitar spam
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error('❌ Erro ao enviar lembretes de saída:', error);
    }
  }

  // Método para testar lembretes manualmente
  async testClockInReminder() {
    console.log('🧪 Teste manual: Enviando lembretes de entrada');
    await this.sendClockInReminders();
  }

  async testClockOutReminder() {
    console.log('🧪 Teste manual: Enviando lembretes de saída');
    await this.sendClockOutReminders();
  }

  // Método para parar o agendador
  stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('📅 Sistema de lembretes automáticos parado');
  }
}

export const schedulerService = new SchedulerService();