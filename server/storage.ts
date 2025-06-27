﻿import { mapEmployee } from '../client/src/mappers/employee';
import type { Express } from "express";
import {
    type Employee,
    type InsertEmployee,
    type AttendanceRecord,
    type InsertAttendanceRecord,
    type WhatsappMessage,
    type InsertWhatsappMessage,
    type EmployeeWithStatus,
    type Setting,
    type InsertSetting
} from "@shared/schema";
import { db } from './db';

export interface IStorage {
    getEmployee(id: number): Promise<Employee | undefined>;
    getEmployeeByPhone(phone: string): Promise<Employee | undefined>;
    createEmployee(employee: InsertEmployee): Promise<Employee>;
    updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
    permanentlyDeleteEmployee(id: number): Promise<boolean>;
    getAllEmployees(): Promise<Employee[]>;
    getEmployeesWithStatus(): Promise<EmployeeWithStatus[]>;
    createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
    getAttendanceRecords(employeeId?: number, date?: Date): Promise<AttendanceRecord[]>;
    getLatestAttendanceRecord(employeeId: number): Promise<AttendanceRecord | undefined>;
    createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
    getUnprocessedMessages(): Promise<WhatsappMessage[]>;
    markMessageAsProcessed(id: number, response: string): Promise<void>;
    getRecentMessages(limit?: number): Promise<WhatsappMessage[]>;
    getStats(): Promise<{
        activeEmployees: number;
        presentToday: number;
        onBreak: number;
        messagesProcessed: number;
    }>;
    getSetting(key: string): Promise<Setting | undefined>;
    setSetting(key: string, value: string, type?: string): Promise<Setting>;
    getAllSettings(): Promise<Setting[]>;
    saveTemporaryLocation(phone: string, location: { latitude?: string; longitude?: string; address?: string }): Promise<void>;
    getTemporaryLocation(phone: string): Promise<{ latitude?: string; longitude?: string; address?: string } | undefined>;
    clearTemporaryLocation(phone: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
    private temporaryLocations: Map<string, { location: { latitude?: string; longitude?: string; address?: string }, timestamp: number }> = new Map();
    async getEmployee(id: number): Promise<Employee | undefined> {
        const stmt = db.prepare("SELECT * FROM employees WHERE id = ?");
        return stmt.get(id) as Employee | undefined;
    }

    async getEmployeeByPhone(phone: string): Promise<Employee | undefined> {
        const stmt = db.prepare("SELECT * FROM employees WHERE phone = ?");
        const result = stmt.get(phone);
        return result ? mapEmployee(result) : undefined;
    }

    async createEmployee(employee: InsertEmployee): Promise<Employee> {
        try {
            const stmt = db.prepare(`
        INSERT INTO employees (name, phone, department, is_active) 
        VALUES (?, ?, ?, 1)
    `);
            const result = stmt.run(employee.name, employee.phone, employee.department);
            const getStmt = db.prepare("SELECT id, name, phone, department, is_active FROM employees WHERE id = ?");
            return mapEmployee(getStmt.get(result.lastInsertRowid));
        } catch (err) {
            console.error("Erro ao criar funcionário:", err);
            throw err;
        }
    }


    async getAllEmployees(): Promise<Employee[]> {
        const stmt = db.prepare("SELECT * FROM employees ORDER BY is_active DESC, name");
        const rows = stmt.all();
        return rows.map(mapEmployee);
    }

    async updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
        const fields = [];
        const values = [];

        if (data.name !== undefined) {
            fields.push("name = ?");
            values.push(data.name);
        }
        if (data.phone !== undefined) {
            fields.push("phone = ?");
            values.push(data.phone);
        }
        if (data.department !== undefined) {
            fields.push("department = ?");
            values.push(data.department);
        }
        if (data.isActive !== undefined) {
            fields.push("is_active = ?");
            values.push(data.isActive ? 1 : 0);
        }

        if (fields.length === 0) return undefined;

        values.push(id);
        const stmt = db.prepare(`UPDATE employees SET ${fields.join(", ")} WHERE id = ?`);
        stmt.run(...values);

        const getStmt = db.prepare("SELECT * FROM employees WHERE id = ?");
        const result = getStmt.get(id);
        return result ? mapEmployee(result) : undefined;
    }

    async permanentlyDeleteEmployee(id: number): Promise<boolean> {
        try {
            // First, delete all related attendance records
            const deleteAttendanceStmt = db.prepare("DELETE FROM attendance_records WHERE employee_id = ?");
            deleteAttendanceStmt.run(id);

            // Delete all related WhatsApp messages
            const deleteMessagesStmt = db.prepare("DELETE FROM whatsapp_messages WHERE phone = (SELECT phone FROM employees WHERE id = ?)");
            deleteMessagesStmt.run(id);

            // Finally, delete the employee
            const deleteEmployeeStmt = db.prepare("DELETE FROM employees WHERE id = ?");
            const result = deleteEmployeeStmt.run(id);

            return result.changes > 0;
        } catch (error) {
            console.error("Error permanently deleting employee:", error);
            return false;
        }
    }

    async getEmployeesWithStatus(): Promise<EmployeeWithStatus[]> {
        const employees = await this.getAllEmployees();
        const withStatus: EmployeeWithStatus[] = [];
        for (const emp of employees) {
            const latest = await this.getLatestAttendanceRecord(emp.id);
            let currentStatus: EmployeeWithStatus["currentStatus"] = 'ausente';
            let clockInTime;
            let lastAction;
            let lastActionTime;
            if (latest) {
                lastAction = latest.type;
                lastActionTime = new Date(latest.timestamp);
                if (latest.type === 'entrada' || latest.type === 'volta') {
                    currentStatus = 'trabalhando';
                    clockInTime = new Date(latest.timestamp).toTimeString().slice(0, 5);
                } else if (latest.type === 'pausa') {
                    currentStatus = 'pausa';
                } else if (latest.type === 'saida') {
                    currentStatus = 'saiu';
                }
            }
            withStatus.push({ ...emp, currentStatus, clockInTime, lastAction, lastActionTime });
        }
        return withStatus;
    }

    async createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord> {
        const stmt = db.prepare(`
            INSERT INTO attendance_records (employee_id, type, message, latitude, longitude, address) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            record.employeeId, 
            record.type, 
            record.message || null,
            record.latitude || null,
            record.longitude || null,
            record.address || null
        );

        const getStmt = db.prepare("SELECT * FROM attendance_records WHERE id = ?");
        return getStmt.get(result.lastInsertRowid) as AttendanceRecord;
    }

    async getAttendanceRecords(employeeId?: number, date?: Date): Promise<AttendanceRecord[]> {
        let query = "SELECT * FROM attendance_records";
        const conditions = [];
        const params = [];

        if (employeeId !== undefined) {
            conditions.push("employee_id = ?");
            params.push(employeeId);
        }
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            conditions.push("timestamp >= ? AND timestamp <= ?");
            params.push(start.toISOString(), end.toISOString());
        }
        if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
        query += " ORDER BY timestamp DESC";

        const stmt = db.prepare(query);
        return stmt.all(...params) as AttendanceRecord[];
    }

    async getLatestAttendanceRecord(employeeId: number): Promise<AttendanceRecord | undefined> {
        const stmt = db.prepare(`
            SELECT * FROM attendance_records 
            WHERE employee_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 1
        `);
        return stmt.get(employeeId) as AttendanceRecord | undefined;
    }

    async createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
        const stmt = db.prepare(`
            INSERT INTO whatsapp_messages (phone, message, command, response) 
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(
            message.phone,
            message.message,
            message.command || null,
            message.response || null
        );

        const getStmt = db.prepare("SELECT * FROM whatsapp_messages WHERE id = ?");
        return getStmt.get(result.lastInsertRowid) as WhatsappMessage;
    }

    async getUnprocessedMessages(): Promise<WhatsappMessage[]> {
        const stmt = db.prepare("SELECT * FROM whatsapp_messages WHERE processed = 0 ORDER BY timestamp");
        return stmt.all() as WhatsappMessage[];
    }

    async markMessageAsProcessed(id: number, response: string): Promise<void> {
        const stmt = db.prepare("UPDATE whatsapp_messages SET processed = 1, response = ? WHERE id = ?");
        stmt.run(response, id);
    }

    async getRecentMessages(limit = 10): Promise<WhatsappMessage[]> {
        const stmt = db.prepare("SELECT * FROM whatsapp_messages ORDER BY timestamp DESC LIMIT ?");
        return stmt.all(limit) as WhatsappMessage[];
    }

    async getStats(): Promise<{
        activeEmployees: number;
        presentToday: number;
        onBreak: number;
        messagesProcessed: number;
    }> {
        const activeStmt = db.prepare("SELECT COUNT(*) as count FROM employees WHERE is_active = 1");
        const messagesStmt = db.prepare("SELECT COUNT(*) as count FROM whatsapp_messages WHERE processed = 1");

        const activeRes = activeStmt.get() as { count: number };
        const messagesRes = messagesStmt.get() as { count: number };

        const employeesWithStatus = await this.getEmployeesWithStatus();
        const presentToday = employeesWithStatus.filter(e => e.currentStatus === 'trabalhando' || e.currentStatus === 'pausa').length;
        const onBreak = employeesWithStatus.filter(e => e.currentStatus === 'pausa').length;

        return {
            activeEmployees: activeRes.count,
            presentToday,
            onBreak,
            messagesProcessed: messagesRes.count
        };
    }

    async getSetting(key: string): Promise<Setting | undefined> {
        const stmt = db.prepare("SELECT * FROM settings WHERE key = ?");
        return stmt.get(key) as Setting | undefined;
    }

    async setSetting(key: string, value: string, type = "string"): Promise<Setting> {
        const existing = await this.getSetting(key);
        if (existing) {
            const stmt = db.prepare("UPDATE settings SET value = ?, type = ?, updated_at = ? WHERE key = ?");
            stmt.run(value, type, new Date().toISOString(), key);
        } else {
            const stmt = db.prepare("INSERT INTO settings (key, value, type) VALUES (?, ?, ?)");
            stmt.run(key, value, type);
        }

        const getStmt = db.prepare("SELECT * FROM settings WHERE key = ?");
        return getStmt.get(key) as Setting;
    }

    async getAllSettings(): Promise<Setting[]> {
        const stmt = db.prepare("SELECT * FROM settings ORDER BY key");
        return stmt.all() as Setting[];
    }

    async saveTemporaryLocation(phone: string, location: { latitude?: string; longitude?: string; address?: string }): Promise<void> {
        // Guarda localização temporariamente por 5 minutos
        this.temporaryLocations.set(phone, {
            location,
            timestamp: Date.now()
        });
        
        // Limpa localizações antigas (mais de 5 minutos)
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        this.temporaryLocations.forEach((value, key) => {
            if (value.timestamp < fiveMinutesAgo) {
                this.temporaryLocations.delete(key);
            }
        });
    }

    async getTemporaryLocation(phone: string): Promise<{ latitude?: string; longitude?: string; address?: string } | undefined> {
        const stored = this.temporaryLocations.get(phone);
        if (!stored) return undefined;
        
        // Verifica se não expirou (5 minutos)
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        if (stored.timestamp < fiveMinutesAgo) {
            this.temporaryLocations.delete(phone);
            return undefined;
        }
        
        return stored.location;
    }

    async clearTemporaryLocation(phone: string): Promise<void> {
        this.temporaryLocations.delete(phone);
    }
}

export const storage = new DatabaseStorage();
