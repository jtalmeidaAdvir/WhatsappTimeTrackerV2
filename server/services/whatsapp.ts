import { storage } from "../storage";
import type { InsertAttendanceRecord } from "@shared/schema";
import qrcode from 'qrcode-terminal';

export class WhatsAppService {
  private readonly validCommands = ['entrada', 'saida', 'pausa', 'volta', 'horas'];
  private client: any = null;
  private isReady: boolean = false;
  private Client: any = null;
  private LocalAuth: any = null;
  private currentQRCode: string | null = null;

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
        // Store QR code for web display
        this.currentQRCode = qr;
      });

      this.client.on('ready', () => {
        console.log('✅ WhatsApp Web.js client está pronto!');
        this.isReady = true;
        this.currentQRCode = null; // Clear QR code when connected
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

    // Location is optional but encouraged
    const hasLocation = location && (location.latitude || location.longitude);

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
    
    let response = `✅ Entrada registada com sucesso!\n⏰ Horário: ${timeStr}\n👤 Funcionário: ${employeeName}`;
    
    if (hasLocation) {
      response += `\n📍 Localização registada`;
    } else {
      response += `\n\n💡 *Dica:* Na próxima vez, envia a tua localização junto com o comando para um registo mais completo!`;
    }
    
    return response;
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

    // Location is optional but encouraged for saida
    const hasLocation = location && (location.latitude || location.longitude);

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
    
    let response = `✅ Saída registada com sucesso!\n⏰ Horário: ${timeStr}\n👤 Funcionário: ${employeeName}`;
    
    if (hasLocation) {
      response += `\n📍 Localização registada`;
    } else {
      response += `\n\n💡 *Dica:* Para próximos registos, considera enviar a localização para maior precisão!`;
    }
    
    return response;
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
    return this.currentQRCode;
  }

  // Method to get QR code as base64 image
  public async getQRCodeImage(): Promise<string | null> {
    if (!this.currentQRCode) {
      return null;
    }
    
    try {
      const QRCode = await import('qrcode');
      const qrImage = await QRCode.toDataURL(this.currentQRCode, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrImage;
    } catch (error) {
      console.error('Erro ao gerar QR code:', error);
      return null;
    }
  }

  // Method to reconnect WhatsApp
  public async reconnect(): Promise<void> {
    try {
      console.log('🔄 Iniciando reconexão do WhatsApp...');
      
      // Mark as not ready
      this.isReady = false;
      
      // Destroy existing client if it exists
      if (this.client) {
        try {
          console.log('🛑 Parando cliente existente...');
          await this.client.destroy();
        } catch (destroyError) {
          console.log('⚠️ Erro ao parar cliente (ignorando):', destroyError);
        }
        this.client = null;
      }
      
      // Wait longer before reconnecting to ensure cleanup
      console.log('⏳ Aguardando limpeza do cliente...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Initialize new client
      console.log('🚀 Inicializando novo cliente...');
      await this.initializeClient();
      
      console.log('✅ Reconexão iniciada. Aguarde o QR code aparecer no console.');
    } catch (error) {
      console.error('❌ Erro durante a reconexão:', error);
      // Don't throw error to prevent server crash - just log it
      console.log('🔄 Tentando recuperar WhatsApp automaticamente...');
      this.isReady = false;
      this.client = null;
    }
  }

  // Method to restart WhatsApp service completely (safer method)
  public async restart(): Promise<void> {
    try {
      console.log('🔄 Reiniciando serviço do WhatsApp completamente...');
      
      // Mark as not ready
      this.isReady = false;
      
      // Force cleanup
      if (this.client) {
        try {
          console.log('🛑 Forçando parada do cliente...');
          this.client.removeAllListeners();
          await this.client.destroy();
        } catch (error) {
          console.log('⚠️ Erro na limpeza (ignorando):', error);
        } finally {
          this.client = null;
        }
      }
      
      // Wait for complete cleanup
      console.log('⏳ Aguardando limpeza completa...');
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Initialize fresh client
      console.log('🚀 Inicializando cliente completamente novo...');
      await this.initializeClient();
      
      console.log('✅ Reinicialização completa. Aguarde o QR code aparecer no console.');
    } catch (error) {
      console.error('❌ Erro durante reinicialização:', error);
      this.isReady = false;
      this.client = null;
    }
  }

  // Method to force new authentication (clears saved credentials)
  public async forceNewAuth(): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      console.log('🔄 Forçando nova autenticação do WhatsApp...');
      
      // Mark as not ready
      this.isReady = false;
      
      // Destroy existing client
      if (this.client) {
        try {
          console.log('🛑 Parando cliente existente...');
          this.client.removeAllListeners();
          await this.client.destroy();
        } catch (error) {
          console.log('⚠️ Erro ao parar cliente (ignorando):', error);
        } finally {
          this.client = null;
        }
      }
      
      // Remove saved authentication data
      try {
        console.log('🗑️ Removendo dados de autenticação salvos...');
        const authPath = path.join(process.cwd(), '.wwebjs_auth');
        if (fs.existsSync(authPath)) {
          fs.rmSync(authPath, { recursive: true, force: true });
          console.log('✅ Dados de autenticação removidos');
        }
      } catch (error) {
        console.log('⚠️ Erro ao remover dados de auth (ignorando):', error);
      }
      
      // Wait for cleanup
      console.log('⏳ Aguardando limpeza completa...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Initialize new client
      console.log('🚀 Inicializando cliente novo com nova autenticação...');
      await this.initializeClient();
      
      console.log('✅ Nova autenticação iniciada. Escaneie o QR code para conectar um novo número.');
    } catch (error) {
      console.error('❌ Erro durante nova autenticação:', error);
      this.isReady = false;
      this.client = null;
    }
  }

}

export const whatsappService = new WhatsAppService();
