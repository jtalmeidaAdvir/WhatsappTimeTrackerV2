/**
 * Utilidades para gestão de fusos horários - Portugal (Europe/Lisbon)
 */

/**
 * Obtém a data/hora atual no fuso horário de Portugal
 */
export function getPortugalTime(): Date {
  const now = new Date();
  // Converter para fuso horário de Portugal (Europe/Lisbon)
  const portugalTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Lisbon"}));
  return portugalTime;
}

/**
 * Formatar data/hora no formato português
 */
export function formatPortugalTime(date?: Date): string {
  const targetDate = date || getPortugalTime();
  return targetDate.toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

/**
 * Obtém apenas a hora no formato HH:MM no fuso horário de Portugal
 */
export function getPortugalTimeString(date?: Date): string {
  const targetDate = date || getPortugalTime();
  return targetDate.toLocaleTimeString("pt-PT", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Verifica se uma hora específica (HH:MM) corresponde à hora atual em Portugal
 */
export function isPortugalTime(targetHour: number, targetMinute: number = 0): boolean {
  const portugalTime = getPortugalTime();
  const currentHour = parseInt(portugalTime.toLocaleTimeString("pt-PT", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    hour12: false
  }));
  const currentMinute = parseInt(portugalTime.toLocaleTimeString("pt-PT", {
    timeZone: "Europe/Lisbon",
    minute: "2-digit"
  }));
  
  return currentHour === targetHour && currentMinute === targetMinute;
}

/**
 * Converter timestamp para data de Portugal
 */
export function timestampToPortugalDate(timestamp: string | number | Date): Date {
  const date = new Date(timestamp);
  return new Date(date.toLocaleString("en-US", {timeZone: "Europe/Lisbon"}));
}

/**
 * Criar timestamp atual com fuso horário de Portugal
 */
export function createPortugalTimestamp(): string {
  return getPortugalTime().toISOString();
}