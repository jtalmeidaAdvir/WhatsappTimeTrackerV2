import { storage } from "../storage";
import type { InsertAttendanceRecord } from "@shared/schema";
import qrcode from 'qrcode-terminal';

export class WhatsAppService {
  private readonly validCommands = ['entrada', 'saida', 'pausa', 'volta', 'horas'];
  private client: any = null;
  private isReady: boolean = false;
  private Client: any = null;
  private LocalAuth: any = null;

  constructor() {
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      // Dynamic import for whatsapp-web.js
      const whatsappWebJs = await import('whatsapp-web.js');
      this.Client = whatsappWebJs.default?.Client || whatsappWebJs.Client;
      this.LocalAuth = whatsappWebJs.default?.LocalAuth || whatsappWebJs.LocalAuth;

      this.client = new this.Client({
        authStrategy: new this.LocalAuth(),
        puppeteer: {
          headless: true,
          executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        }
      });

      this.client.on('qr', (qr: string) => {
        console.log('\n🔗 Para conectar o WhatsApp, escaneie o QR code abaixo:');
        qrcode.generate(qr, { small: true });
        console.log('\nAbra o WhatsApp no seu telemóvel > Menu > Dispositivos conectados > Conectar dispositivo');
      });

      this.client.on('ready', () => {
        console.log('✅ WhatsApp Web.js client está pronto!');
        this.isReady = true;
      });

      this.client.on('authenticated', () => {
        console.log('✅ WhatsApp autenticado com sucesso!');
      });

      this.client.on('auth_failure', (msg: any) => {
        console.error('❌ Falha na autenticação do WhatsApp:', msg);
      });

      this.client.on('disconnected', (reason: any) => {
        console.log('❌ WhatsApp desconectado:', reason);
        this.isReady = false;
      });

      this.client.on('message', async (message: any) => {
        await this.handleIncomingMessage(message);
      });

      await this.client.initialize();
    } catch (error) {
      console.error('❌ Erro ao inicializar WhatsApp-Web.js:', error);
    }
  }

  private async handleIncomingMessage(message: any): Promise<void> {
    try {
      // Ignore messages from groups and status updates
      if (message.from.includes('@g.us') || message.from === 'status@broadcast') {
        return;
      }

      // Ignore messages from the bot itself
      if (message.fromMe) {
        return;
      }

      const phone = `+${message.from.replace('@c.us', '')}`;
      const messageBody = message.body.toLowerCase().trim();

      console.log(`📱 Mensagem recebida de ${phone}: ${messageBody}`);

      let location: { latitude?: string; longitude?: string; address?: string } | undefined;

      // Check if message has location
      if (message.location) {
        location = {
          latitude: message.location.latitude?.toString(),
          longitude: message.location.longitude?.toString(),
          address: message.location.description || ''
        };
        console.log(`📍 Localização recebida: lat=${location.latitude}, lng=${location.longitude}`);
        
        // Handle location-only message
        if (!messageBody || messageBody === '') {
          const response = await this.processMessage(phone, 'location_received', location);
          await this.sendMessage(phone, response);
          return;
        }
      }

      // Process the message
      const response = await this.processMessage(phone, messageBody, location);
      
      // Send response
      await this.sendMessage(phone, response);
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }

  async processMessage(phone: string, message: string, location?: { latitude?: string; longitude?: string; address?: string }): Promise<string> {
    // Handle location-only messages
    if (message === "location_received" && location) {
      console.log(`Localização recebida de ${phone}: lat=${location.latitude}, lng=${location.longitude}`);
      // Save location temporarily for next command
      await storage.saveTemporaryLocation(phone, location);
      return `📍 Localização recebida com sucesso!\n\nAgora escreva o comando pretendido:\n🟢 *entrada* - Marcar entrada\n🔴 *saida* - Marcar saída\n🟡 *pausa* - Iniciar pausa\n🟢 *volta* - Voltar da pausa\n⏱️ *horas* - Ver horas trabalhadas`;
    }

    const command = this.extractCommand(message.toLowerCase().trim());
    
    // Save the incoming message
    await storage.createWhatsappMessage({
      phone,
      message,
      command: command || undefined,
    });

    if (!command) {
      return this.getHelpMessage();
    }

    const employee = await storage.getEmployeeByPhone(phone);
    if (!employee) {
      return "Funcionário não encontrado. Entre em contacto com os Recursos Humanos para registo.";
    }

    if (!employee.isActive) {
      return "A sua conta está inactiva. Entre em contacto com os Recursos Humanos.";
    }

    // Se não há localização passada diretamente, verifica se há uma salva temporariamente
    if (!location) {
      location = await storage.getTemporaryLocation(phone);
      if (location) {
        console.log(`Usando localização temporária para ${phone}: lat=${location.latitude}, lng=${location.longitude}`);
        // Limpa a localização temporária após usar
        await storage.clearTemporaryLocation(phone);
      }
    }

    const response = await this.executeCommand(employee.id, command, location);
    
    // Mark message as processed
    const messages = await storage.getUnprocessedMessages();
    const messageRecord = messages.find(m => m.phone === phone && m.message === message);
    if (messageRecord) {
      await storage.markMessageAsProcessed(messageRecord.id, response);
    }

    return response;
  }

  private extractCommand(message: string): string | null {
    const words = message.split(/\s+/);
    for (const word of words) {
      if (this.validCommands.includes(word)) {
        return word;
      }
    }
    return null;
  }

  private async executeCommand(employeeId: number, command: string, location?: { latitude?: string; longitude?: string; address?: string }): Promise<string> {
    const employee = await storage.getEmployee(employeeId);
    if (!employee) {
      return "Erro interno. Tente novamente.";
    }

    const latestRecord = await storage.getLatestAttendanceRecord(employeeId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if there's already a record today
    const todaysRecords = await storage.getAttendanceRecords(employeeId, today);
    
    switch (command) {
      case 'entrada':
        return this.handleEntrada(employeeId, employee.name, todaysRecords, location);
      
      case 'saida':
        return this.handleSaida(employeeId, employee.name, todaysRecords, location);
      
      case 'pausa':
        return this.handlePausa(employeeId, employee.name, latestRecord, location);
      
      case 'volta':
        return this.handleVolta(employeeId, employee.name, latestRecord, location);
      
      case 'horas':
        return this.handleHoras(employeeId, employee.name, todaysRecords);
      
      default:
        return this.getHelpMessage();
    }
  }

  private async handleEntrada(employeeId: number, employeeName: string, todaysRecords: any[], location?: { latitude?: string; longitude?: string; address?: string }): Promise<string> {
    console.log(`Checking entrada for employee ${employeeId}, today's records:`, todaysRecords.map(r => ({type: r.type, timestamp: r.timestamp})));
    
    const hasEntrada = todaysRecords.some(r => r.type === 'entrada');
    
    if (hasEntrada) {
      return `${employeeName}, já registaste a entrada hoje!`;
    }

    // Always require location for entrada
    if (!location || (!location.latitude && !location.longitude)) {
      return `📍 *${employeeName}*, para registar a tua entrada, preciso da tua localização.\n\n🔹 *Como enviar:*\n1. Toca no 📎 (anexar)\n2. Escolhe *Localização*\n3. Selecciona *Localização ao vivo* ou *Enviar a tua localização actual*\n4. Após enviares a localização, escreve *entrada* novamente\n\n⚠️ *Importante:* Envia primeiro a localização, depois o comando entrada.`;
    }

    // Validate work hours
    const workHoursValidation = await this.validateWorkHours();
    if (!workHoursValidation.isValid) {
      return workHoursValidation.message;
    }

    await storage.createAttendanceRecord({
      employeeId,
      type: 'entrada',
      message: 'Entrada registrada via WhatsApp',
      latitude: location?.latitude,
      longitude: location?.longitude,
      address: location?.address
    });

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    return `✅ Entrada registada com sucesso!\n⏰ Horário: ${timeStr}\n👤 Funcionário: ${employeeName}`;
  }

  private async handleSaida(employeeId: number, employeeName: string, todaysRecords: any[], location?: { latitude?: string; longitude?: string; address?: string }): Promise<string> {
    const hasEntrada = todaysRecords.some(r => r.type === 'entrada');
    const hasSaida = todaysRecords.some(r => r.type === 'saida');
    
    if (!hasEntrada) {
      return `${employeeName}, precisas de registar a entrada primeiro!`;
    }

    if (hasSaida) {
      return `${employeeName}, já registaste a saída hoje!`;
    }

    // Always require location for saida
    if (!location || (!location.latitude && !location.longitude)) {
      return `📍 *${employeeName}*, para registar a tua saída, preciso da tua localização.\n\n🔹 *Como enviar:*\n1. Toca no 📎 (anexar)\n2. Escolhe *Localização*\n3. Selecciona *Localização ao vivo* ou *Enviar a tua localização actual*\n4. Após enviares a localização, escreve *saida* novamente\n\n⚠️ *Importante:* Envia primeiro a localização, depois o comando saida.`;
    }

    await storage.createAttendanceRecord({
      employeeId,
      type: 'saida',
      message: 'Saída registrada via WhatsApp',
      latitude: location?.latitude,
      longitude: location?.longitude,
      address: location?.address
    });

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    return `✅ Saída registada com sucesso!\n⏰ Horário: ${timeStr}\n👤 Funcionário: ${employeeName}`;
  }

  private async handlePausa(employeeId: number, employeeName: string, latestRecord: any, location?: { latitude?: string; longitude?: string; address?: string }): Promise<string> {
    if (!latestRecord || latestRecord.type !== 'entrada' && latestRecord.type !== 'volta') {
      return `${employeeName}, precisas de estar a trabalhar para fazer pausa!`;
    }

    if (latestRecord.type === 'pausa') {
      return `${employeeName}, já estás em pausa!`;
    }

    await storage.createAttendanceRecord({
      employeeId,
      type: 'pausa',
      message: 'Pausa iniciada via WhatsApp',
      latitude: location?.latitude,
      longitude: location?.longitude,
      address: location?.address
    });

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    return `⏸️ Pausa iniciada!\n⏰ Horário: ${timeStr}\n👤 Funcionário: ${employeeName}\n\n💡 Para voltar ao trabalho, escreve *volta*`;
  }

  private async handleVolta(employeeId: number, employeeName: string, latestRecord: any, location?: { latitude?: string; longitude?: string; address?: string }): Promise<string> {
    if (!latestRecord || latestRecord.type !== 'pausa') {
      return `${employeeName}, não estás em pausa!`;
    }

    await storage.createAttendanceRecord({
      employeeId,
      type: 'volta',
      message: 'Volta da pausa via WhatsApp',
      latitude: location?.latitude,
      longitude: location?.longitude,
      address: location?.address
    });

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    return `▶️ Volta da pausa registada!\n⏰ Horário: ${timeStr}\n👤 Funcionário: ${employeeName}`;
  }

  private async handleHoras(employeeId: number, employeeName: string, todaysRecords: any[]): Promise<string> {
    if (todaysRecords.length === 0) {
      return `⏰ *${employeeName}*, ainda não tens registos hoje.\n\nPara consultar as horas trabalhadas, precisa primeiro de registar a entrada.`;
    }

    // Calculate total worked hours for today
    let totalMinutes = 0;
    let currentlyWorking = false;
    let lastEntrada: Date | null = null;
    let pauseMinutes = 0;
    let currentPauseStart: Date | null = null;

    // Sort records by timestamp
    const sortedRecords = todaysRecords.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    for (const record of sortedRecords) {
      const recordTime = new Date(record.timestamp);
      
      switch (record.type) {
        case 'entrada':
          lastEntrada = recordTime;
          currentlyWorking = true;
          break;
          
        case 'saida':
          if (lastEntrada) {
            const workMinutes = Math.floor((recordTime.getTime() - lastEntrada.getTime()) / (1000 * 60));
            totalMinutes += workMinutes;
            currentlyWorking = false;
            lastEntrada = null;
          }
          break;
          
        case 'pausa':
          currentPauseStart = recordTime;
          break;
          
        case 'volta':
          if (currentPauseStart) {
            const pauseDuration = Math.floor((recordTime.getTime() - currentPauseStart.getTime()) / (1000 * 60));
            pauseMinutes += pauseDuration;
            currentPauseStart = null;
          }
          break;
      }
    }

    // If currently working, add time from last entrada to now
    if (currentlyWorking && lastEntrada) {
      const now = new Date();
      const currentWorkMinutes = Math.floor((now.getTime() - lastEntrada.getTime()) / (1000 * 60));
      totalMinutes += currentWorkMinutes;
    }

    // Convert minutes to hours and minutes
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const pauseHours = Math.floor(pauseMinutes / 60);
    const pauseMins = pauseMinutes % 60;

    // Format the response
    let response = `⏱️ *Horas trabalhadas hoje*\n👤 Funcionário: ${employeeName}\n\n`;
    
    if (hours > 0 || minutes > 0) {
      response += `⏰ Tempo trabalhado: ${hours}h ${minutes}m\n`;
    } else {
      response += `⏰ Tempo trabalhado: 0h 0m\n`;
    }
    
    if (pauseMinutes > 0) {
      response += `⏸️ Tempo de pausa: ${pauseHours}h ${pauseMins}m\n`;
    }
    
    // Add current status
    const latestRecord = sortedRecords[sortedRecords.length - 1];
    if (latestRecord) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      response += `\n📊 Estado actual: `;
      
      switch (latestRecord.type) {
        case 'entrada':
        case 'volta':
          response += `A trabalhar 🟢\n🕐 Desde: ${new Date(latestRecord.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
          break;
        case 'pausa':
          response += `Em pausa 🟡\n🕐 Desde: ${new Date(latestRecord.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
          break;
        case 'saida':
          response += `Saiu 🔴\n🕐 Às: ${new Date(latestRecord.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
          break;
      }
    }

    return response;
  }

  private async validateWorkHours(): Promise<{ isValid: boolean; message: string }> {
    try {
      // Get work hours settings
      const startTimeSetting = await storage.getSetting('startTime');
      const endTimeSetting = await storage.getSetting('endTime');
      
      // Default work hours if not configured
      const startTime = startTimeSetting?.value || '08:00';
      const endTime = endTimeSetting?.value || '17:00';
      
      // Use Portuguese timezone
      const now = new Date();
      const currentTime = now.toLocaleTimeString('pt-PT', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      
      // Convert time strings to minutes for comparison
      const timeToMinutes = (time: string): number => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      const currentMinutes = timeToMinutes(currentTime);
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      
      // Check if current time is within work hours
      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        return {
          isValid: false,
          message: `⏰ Fora do horário de trabalho!\n📅 Horário permitido: ${startTime} às ${endTime}\n🕐 Horário actual: ${currentTime}\n\nTenta registar a entrada dentro do horário de trabalho.`
        };
      }
      
      return { isValid: true, message: '' };
    } catch (error) {
      console.error('Error validating work hours:', error);
      // If there's an error getting settings, allow entry (fail open)
      return { isValid: true, message: '' };
    }
  }

  private getHelpMessage(): string {
    return `📋 *Comandos disponíveis:*\n\n` +
           `🟢 *entrada* - Marcar entrada\n` +
           `🔴 *saida* - Marcar saída\n` +
           `🟡 *pausa* - Iniciar pausa\n` +
           `🟢 *volta* - Voltar da pausa\n` +
           `⏱️ *horas* - Ver horas trabalhadas hoje\n\n` +
           `Envie apenas a palavra do comando.`;
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    try {
      if (!this.client || !this.isReady) {
        console.error('❌ WhatsApp client não está pronto');
        return;
      }

      // Convert phone number to WhatsApp format
      const cleanPhone = phone.replace(/[+\s]/g, '');
      const chatId = `${cleanPhone}@c.us`;

      await this.client.sendMessage(chatId, message);
      console.log(`✅ Mensagem enviada para ${phone}: ${message.substring(0, 50)}...`);
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para ${phone}:`, error);
    }
  }

  // Method to check if WhatsApp is ready
  public isWhatsAppReady(): boolean {
    return this.isReady;
  }

  // Method to get QR code for authentication
  public async getQRCode(): Promise<string | null> {
    if (this.client && !this.isReady) {
      return 'Aguarde o QR code aparecer no console...';
    }
    return null;
  }

}

export const whatsappService = new WhatsAppService();
