import { storage } from '../storage.js';
import { whatsappService } from './whatsapp.js';
import { isPortugalTime, getPortugalTime, getPortugalTimeString } from '../utils/timezone.js';

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

    // Verificar pausas prolongadas a cada 5 minutos
    const pauseCheckInterval = setInterval(async () => {
      await this.checkLongBreaks();
    }, 300000); // 5 minutos

    this.intervals.push(checkInterval);
    this.intervals.push(pauseCheckInterval);
    console.log('📅 Sistema de lembretes automáticos iniciado');
    console.log('⏰ Sistema de controlo de pausas iniciado');
  }

  private async checkReminderTimes() {
    // Usar fuso horário de Portugal
    const portugalTime = getPortugalTime();
    console.log(`⏰ Verificando lembretes - Hora em Portugal: ${getPortugalTimeString()}`);
    
    // Lembrete de entrada às 09:00 (Portugal)
    if (isPortugalTime(9, 0)) {
      console.log('📢 Hora de lembrete de entrada (09:00 Portugal)');
      await this.sendClockInReminders();
    }
    
    // Lembrete de saída às 18:00 (Portugal)
    if (isPortugalTime(18, 0)) {
      console.log('📢 Hora de lembrete de saída (18:00 Portugal)');
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

  private async checkLongBreaks() {
    console.log('🔍 Verificando pausas prolongadas...');
    
    try {
      const employees = await storage.getAllEmployees();
      const activeEmployees = employees.filter(emp => emp.isActive);
      
      const now = getPortugalTime();
      
      for (const employee of activeEmployees) {
        // Obter o último registo do funcionário
        const latestRecord = await storage.getLatestAttendanceRecord(employee.id);
        
        if (latestRecord && latestRecord.type === 'pausa') {
          const pauseStartTime = new Date(latestRecord.timestamp);
          const timeDifferenceMinutes = Math.floor((now.getTime() - pauseStartTime.getTime()) / (1000 * 60));
          
          // Se está em pausa há mais de 15 minutos
          if (timeDifferenceMinutes >= 15) {
            // Verificar se já enviámos lembrete recentemente (últimos 30 minutos)
            const recentMessages = await storage.getAttendanceRecords(employee.id);
            const hasRecentPauseReminder = recentMessages.some(record => {
              if (record.type === 'pausa' && record.timestamp) {
                const recordTime = new Date(record.timestamp);
                const minutesAgo = Math.floor((now.getTime() - recordTime.getTime()) / (1000 * 60));
                return minutesAgo <= 30;
              }
              return false;
            });
            
            // Só enviar se não enviou lembrete recentemente
            if (!hasRecentPauseReminder || timeDifferenceMinutes >= 30) {
              await this.sendLongBreakReminder(employee, timeDifferenceMinutes);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao verificar pausas prolongadas:', error);
    }
  }

  private async sendLongBreakReminder(employee: any, minutesOnBreak: number) {
    const message = `🔔 *Lembrete de Pausa*

Olá ${employee.name}! 👋

⏰ Estás em pausa há ${minutesOnBreak} minutos.

💡 Não te esqueças de registar o teu regresso:
👉 Envia: *volta* ou *voltei*

Se ainda precisas de mais tempo, podes ignorar esta mensagem. 😊`;

    try {
      await whatsappService.sendMessage(employee.phone, message);
      console.log(`📤 Lembrete de pausa prolongada enviado para ${employee.name} (${minutesOnBreak} min)`);
    } catch (error) {
      console.error(`❌ Erro ao enviar lembrete de pausa para ${employee.name}:`, error);
    }
  }

  async testLongBreakReminder() {
    console.log('🧪 Teste manual: Verificando pausas prolongadas');
    await this.checkLongBreaks();
  }

  // Método para parar o agendador
  stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('📅 Sistema de lembretes automáticos parado');
  }
}

export const schedulerService = new SchedulerService();