# WhatsApp Time Tracking System

## Overview

This is a full-stack web application that provides employee time tracking functionality through WhatsApp integration. The system allows employees to clock in/out using simple WhatsApp commands and provides a comprehensive dashboard for administrators to manage employees and view attendance records.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Session Management**: Built-in session handling for development

### Key Components

#### Database Schema
The system uses three main tables:
1. **employees**: Stores employee information (name, phone, department, active status)
2. **attendance_records**: Tracks all time entries (entrada, saida, pausa, volta) with timestamps
3. **whatsapp_messages**: Logs all WhatsApp interactions for audit and processing

#### WhatsApp Integration
- Command processing service that handles incoming WhatsApp messages
- Supports four main commands: `entrada`, `saida`, `pausa`, `volta`
- Automatic employee validation and status tracking
- Message logging and response generation

#### Frontend Pages
- **Dashboard**: Overview with statistics and recent activity
- **Employees**: CRUD operations for employee management
- **Time Records**: View and filter attendance records
- **Reports**: Generate and export time tracking reports
- **WhatsApp Integration**: Test and configure WhatsApp functionality
- **Settings**: System configuration options

## Data Flow

1. **Employee Registration**: Administrators add employees through the web interface
2. **WhatsApp Commands**: Employees send messages to the WhatsApp bot with time tracking commands
3. **Message Processing**: The backend validates commands, checks employee status, and records attendance
4. **Real-time Updates**: The dashboard shows live statistics and recent activities
5. **Reporting**: Administrators can generate reports based on date ranges and employee filters

## External Dependencies

### Production Dependencies
- **UI Components**: Extensive Radix UI component library for accessible interfaces
- **Database**: Neon serverless PostgreSQL for data persistence
- **ORM**: Drizzle ORM for type-safe database operations
- **Validation**: Zod for runtime type validation and schema generation
- **Date Handling**: date-fns for date manipulation and formatting

### Development Dependencies
- **Build Tools**: Vite with React plugin and TypeScript support
- **Code Quality**: ESLint and TypeScript for type checking
- **Runtime**: tsx for TypeScript execution in development

## Deployment Strategy

### Development
- Runs on port 5000 with Vite dev server proxy
- Hot module replacement for frontend development
- TypeScript compilation in watch mode for backend
- PostgreSQL database connection via environment variables

### Production
- **Build Process**: 
  1. Frontend built with Vite to static assets
  2. Backend bundled with esbuild for Node.js execution
- **Deployment Target**: Autoscale deployment on Replit
- **Port Configuration**: External port 80 mapping to internal port 5000
- **Environment**: Production mode with optimized builds

### Configuration Files
- **Drizzle**: Configured for PostgreSQL with migration support
- **Tailwind**: Custom theme with CSS variables for design system
- **TypeScript**: Strict mode with path mapping for clean imports
- **Vite**: Optimized for development with Replit integration

## Changelog
```
Changelog:
- June 26, 2025. Initial setup
- June 26, 2025. Integrated Z-API WhatsApp service with manual processing endpoint
- June 26, 2025. Successfully tested employee time tracking via WhatsApp commands
- June 26, 2025. Fixed webhook automation - Z-API now processes WhatsApp messages automatically
- June 26, 2025. José Vale employee successfully tested automatic point registration via WhatsApp
- June 26, 2025. Enhanced help system - automatic detailed instructions for invalid commands
- June 26, 2025. System fully functional - employees can use entrada/saida/pausa/volta commands via WhatsApp
- June 26, 2025. Successfully migrated from Replit Agent to standard Replit environment
- June 26, 2025. Webhook URL updated for new deployment: https://2b9aa4a1-e1f3-4c79-bbd4-343180632163-00-2p74rqczsfiye.riker.replit.dev/api/whatsapp/webhook
- June 26, 2025. Fixed spam issue - system now properly filters bot messages and test messages to prevent loops
- June 26, 2025. Adjusted filtering logic to allow user messages while preventing bot response loops
- June 26, 2025. System now properly shows help options for invalid commands while preventing spam
- June 26, 2025. Simplified help message to be shorter and clearer for users
- June 26, 2025. Fixed Z-API response handling to eliminate false error messages in logs
- June 26, 2025. Successfully migrated from in-memory storage to PostgreSQL database
- June 26, 2025. All employee data, attendance records, and WhatsApp messages now persist in database
- June 26, 2025. Implemented complete edit/remove functionality for employees with confirmation dialogs
- June 26, 2025. Added employee reactivation feature for previously deactivated employees
- June 26, 2025. Built full settings page with persistent database storage for all configurations
- June 26, 2025. Implemented work hours validation - blocks WhatsApp entries outside configured business hours
- June 27, 2025. Successfully migrated from Replit Agent to standard Replit environment
- June 27, 2025. Fixed employee creation issue - new employees now default to active status
- June 27, 2025. Fixed employee reactivation functionality - deactivated employees can now be properly reactivated
- June 27, 2025. Corrected database mapping and API endpoints for proper data handling
- June 27, 2025. Successfully migrated to new Replit environment with dynamic webhook URL
- June 27, 2025. Webhook URL now automatically adapts to current domain: {origin}/api/whatsapp/webhook
- June 27, 2025. Added permanent employee deletion feature - allows complete removal of inactive employees and all related data
- June 27, 2025. Implemented automatic location capture for WhatsApp entries - system now automatically captures GPS coordinates when employees send location before time tracking commands
- June 27, 2025. Added location fields (latitude, longitude, address) to attendance records database
- June 27, 2025. Created temporary location storage system - locations are saved for 5 minutes and automatically used with next time tracking command
- June 27, 2025. Enhanced UI to show location icon when GPS data is available for attendance records
- June 27, 2025. Implemented automatic location request system - employees now receive clear instructions to send location before time tracking commands
- June 27, 2025. Added location-only message detection - system captures GPS coordinates when sent and saves temporarily for next command
- June 27, 2025. Enhanced WhatsApp integration to guide users through location sharing process for all time tracking activities
- June 27, 2025. Added Google Maps integration - users can click on GPS location in time records to open location in Google Maps
- June 27, 2025. System now requires location for all entrada/saida commands and provides clear instructions for location sharing
- June 27, 2025. Location data automatically saved with coordinates and address for all time tracking entries
- June 27, 2025. Fixed employee name display in time records - system now uses JOIN query to show correct names even for deleted employees
- June 27, 2025. Implemented functional quick reports - users can generate reports for today, this week, this month, by employee, and custom date ranges
- June 27, 2025. Reports display real attendance data with employee names, action badges, timestamps, and GPS location links
- June 27, 2025. Translated all WhatsApp messages to Portuguese Portugal (PT-PT) - messages now use correct Portuguese terminology and verb forms
- June 27, 2025. Enhanced pause message - now includes instructions to type "volta" to return to work
- June 27, 2025. Added "horas" command - employees can now query their worked hours for the current day via WhatsApp
- June 27, 2025. Successfully migrated from Z-API to WhatsApp-Web.js (completely free alternative)
- June 27, 2025. WhatsApp-Web.js fully integrated - QR code authentication working properly
- June 27, 2025. System no longer depends on external paid services for WhatsApp functionality
- June 27, 2025. Implemented automatic reminder system - sends clock-in reminders at 09:00 and clock-out reminders at 18:00
- June 27, 2025. Added scheduler service with minute-by-minute verification of reminder times
- June 27, 2025. Clock-in reminders sent only to employees without entry registered for the day
- June 27, 2025. Clock-out reminders sent only to employees with entry but no exit registered
- June 27, 2025. Created test interface for manual reminder testing with dedicated endpoints
- June 27, 2025. All reminder messages personalized with employee names and proper Portuguese formatting
- June 27, 2025. Made location registration automatic and non-mandatory - employees can register without requiring GPS location
- June 27, 2025. System now registers attendance immediately and provides educational tips about location benefits
- June 27, 2025. Enhanced user experience by removing location barriers while maintaining location tracking capabilities
- June 27, 2025. Automatic location capture attempts via WhatsApp Web API when available
- June 27, 2025. Improved feedback messages with location status and helpful suggestions for future use
- June 27, 2025. Successfully migrated from Replit Agent to standard Replit environment
- June 27, 2025. Added WhatsApp number configuration in settings - administrators can now configure and change the main WhatsApp number
- June 27, 2025. Implemented WhatsApp reconnection functionality - allows switching between different WhatsApp accounts/numbers
- June 27, 2025. Created reconnection endpoint (/api/whatsapp/reconnect) for seamless WhatsApp account switching
- June 27, 2025. Enhanced settings page with dedicated WhatsApp configuration section
- June 27, 2025. Implemented QR code display in web interface - no longer requires console access
- June 27, 2025. Added automatic QR code generation as base64 images for web display
- June 27, 2025. Created automatic success detection - QR code closes and shows success message when connection completes
- June 27, 2025. Enhanced user experience with visual loading states and clear connection instructions
- June 27, 2025. Complete WhatsApp number switching now fully integrated in web interface
- June 27, 2025. Enhanced WhatsApp command recognition - system now accepts natural variations like "sair", "vou sair", "tchau", "bom dia", "almoço", "voltei"
- June 27, 2025. Added intelligent command mapping - employees can now use multiple ways to express the same action (entrada/entrar/chegar/bom dia)
- June 27, 2025. Updated help messages to show command examples and encourage natural language usage
```

## User Preferences
```
Preferred communication style: Simple, everyday language.
```