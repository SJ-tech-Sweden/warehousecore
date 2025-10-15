# StorageCore

**Physical Warehouse Management System for Tsunami Events UG**

StorageCore is the digital twin of the Weidelbach warehouse, providing real-time tracking of devices, cases, zones, and movements with barcode/QR scan-driven workflows.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Development](#development)
- [Docker Hub](#docker-hub)

---

## Overview

StorageCore manages the physical warehouse operations for Tsunami Events, synchronizing in real-time with RentalCore (job management system). It provides:

- **Digital warehouse mapping** - Zones, shelves, racks, vehicles, cases
- **Real-time device status** - in_storage | on_job | defective | repair
- **Scan-driven workflows** - Barcode/QR intake, outtake, transfer
- **Full audit trail** - Every movement and scan logged
- **Maintenance tracking** - Defects, repairs, inspection schedules
- **Job synchronization** - Live sync with RentalCore jobs

---

## Features

### Core Modules

1. **Device Tracker**
   - Scan devices in/out of warehouse
   - Track current location (zone, case, job)
   - Status management with history
   - Movement audit trail

2. **Storage Zones**
   - Hierarchical zone structure
   - Shelf, rack, case, vehicle, stage types
   - Capacity tracking
   - Active/inactive management

3. **Scan System**
   - Barcode and QR code support
   - Intake/outtake/transfer/check actions
   - Duplicate scan detection
   - Complete event logging with IP/user-agent

4. **Job Integration**
   - Real-time job assignment
   - Device packing status
   - Missing item detection
   - Job completion workflow

5. **Maintenance Engine**
   - Defect reporting with severity
   - Repair tracking with costs
   - Inspection scheduling
   - Status workflow (open → in_progress → repaired → closed)

---

## Architecture

```
storagecore/
├── cmd/
│   └── server/
│       └── main.go              # Application entry point
├── internal/
│   ├── models/                  # Domain models
│   │   ├── device.go
│   │   ├── zone.go
│   │   ├── movement.go
│   │   ├── scan.go
│   │   ├── maintenance.go
│   │   ├── case.go
│   │   ├── job.go
│   │   └── helpers.go
│   ├── repository/              # Database layer
│   │   └── database.go
│   ├── services/                # Business logic
│   │   └── scan_service.go      # Core scan processing
│   ├── handlers/                # HTTP handlers
│   │   └── handlers.go
│   └── middleware/              # HTTP middleware
│       └── middleware.go
├── migrations/                  # Database migrations
│   ├── 001_storage_zones.sql
│   ├── 002_device_movements.sql
│   ├── 003_scan_events.sql
│   └── 004_defect_reports.sql
├── config/
│   └── config.go                # Configuration management
├── web/                         # Frontend (React + TypeScript + Tailwind)
│   ├── src/
│   ├── public/
│   └── package.json
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## Tech Stack

**Backend:**
- Go 1.22+ (matching RentalCore)
- gorilla/mux (routing)
- MySQL 9.2 (shared RentalCore database)
- CORS enabled

**Frontend:**
- React 18+ with TypeScript
- TailwindCSS with Tsunami Events brand theme
- shadcn/ui components
- Dark mode first-class support

**Infrastructure:**
- Docker + Docker Compose
- Docker Hub: `nobentie/storagecore`
- GitLab: git.server-nt.de/ntielmann/storagecore

---

## Getting Started

### Prerequisites

- Go 1.22+
- MySQL 9.2+ (access to RentalCore database)
- Docker (optional, for containerized deployment)
- Node.js 18+ (for frontend development)

### Local Development

1. **Clone the repository**
```bash
git clone https://git.server-nt.de/ntielmann/storagecore.git
cd storagecore
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Run database migrations**
```bash
# Execute SQL files in migrations/ directory against RentalCore database
mysql -h tsunami-events.de -u tsweb -p RentalCore < migrations/001_storage_zones.sql
mysql -h tsunami-events.de -u tsweb -p RentalCore < migrations/002_device_movements.sql
mysql -h tsunami-events.de -u tsweb -p RentalCore < migrations/003_scan_events.sql
mysql -h tsunami-events.de -u tsweb -p RentalCore < migrations/004_defect_reports.sql
```

4. **Install dependencies**
```bash
go mod download
```

5. **Run the server**
```bash
make run
# Or: go run cmd/server/main.go
```

Server runs on `http://localhost:8081`

### API Health Check
```bash
curl http://localhost:8081/api/v1/health
```

---

## API Documentation

### Base URL
`http://localhost:8081/api/v1`

### Endpoints

#### Health
- `GET /health` - Server health check

#### Scans (CRITICAL)
- `POST /scans` - Process barcode/QR scan
- `GET /scans/history` - Get scan event history

**Scan Request Body:**
```json
{
  "scan_code": "DEVICE123",
  "action": "intake|outtake|check|transfer",
  "job_id": 42,
  "zone_id": 5,
  "notes": "Optional notes"
}
```

**Scan Response:**
```json
{
  "success": true,
  "message": "Device successfully returned to warehouse",
  "device": {...},
  "movement": {...},
  "action": "intake",
  "previous_status": "on_job",
  "new_status": "in_storage",
  "duplicate": false
}
```

#### Devices
- `GET /devices` - List devices (filters: status, zone_id, limit)
- `GET /devices/{id}` - Get device details
- `PUT /devices/{id}/status` - Update device status
- `GET /devices/{id}/movements` - Get device movement history

#### Zones
- `GET /zones` - List all zones
- `POST /zones` - Create new zone
- `GET /zones/{id}` - Get zone details
- `PUT /zones/{id}` - Update zone
- `DELETE /zones/{id}` - Soft-delete zone

#### Jobs
- `GET /jobs` - List active jobs
- `GET /jobs/{id}` - Get job summary with device status
- `POST /jobs/{id}/complete` - Complete job

#### Cases
- `GET /cases` - List all cases
- `GET /cases/{id}` - Get case details
- `GET /cases/{id}/contents` - Get case contents

#### Maintenance
- `GET /defects` - List defect reports (filters: status, severity, device_id)
- `POST /defects` - Create defect report
- `PUT /defects/{id}` - Update defect status, costs, notes
- `GET /maintenance/inspections` - Get inspection schedules (filters: upcoming, overdue, all)
- `GET /maintenance/stats` - Get maintenance dashboard statistics

#### Dashboard
- `GET /dashboard/stats` - Get warehouse statistics
- `GET /movements` - Get recent movements

---

## Database Schema

### New Tables (StorageCore-specific)

**storage_zones** - Logical warehouse areas
- zone_id, code, name, type, description, parent_zone_id, capacity, is_active

**device_movements** - Audit trail of all device movements
- movement_id, device_id, action, from_zone_id, to_zone_id, from_job_id, to_job_id, barcode, user_id, notes, metadata, timestamp

**scan_events** - Complete scan log
- scan_id, scan_code, scan_type, device_id, action, job_id, zone_id, user_id, success, error_message, metadata, ip_address, user_agent, timestamp

**defect_reports** - Detailed defect tracking
- defect_id, device_id, severity, status, title, description, reported_by, reported_at, assigned_to, repaired_by, repaired_at, repair_cost, repair_notes, closed_at, images, metadata

**inspection_schedules** - Periodic inspection requirements
- schedule_id, device_id, product_id, inspection_type, interval_days, last_inspection, next_inspection, is_active

### Existing Tables (from RentalCore)
- devices, cases, devicescases, jobs, jobdevices, products, maintenanceLogs, customers

---

## Deployment

### Docker (Recommended)

**Build Docker image:**
```bash
make docker-build
# Or manually:
docker build -t nobentie/storagecore:1.0 .
docker tag nobentie/storagecore:1.0 nobentie/storagecore:latest
```

**Push to Docker Hub:**
```bash
make docker-push
# Or manually:
docker push nobentie/storagecore:1.0
docker push nobentie/storagecore:latest
```

**Run with docker-compose:**
```bash
# Pull latest image from Docker Hub
docker-compose pull

# Start the service
docker-compose up -d
```

> **Note:** docker-compose.yml is configured to use the `nobentie/storagecore:latest` image from Docker Hub.

**Check logs:**
```bash
docker-compose logs -f storagecore
```

### Production Deployment

1. Ensure database migrations are applied
2. Build and push Docker image with version tag (1.X)
3. Update production docker-compose or k8s manifests
4. Pull and restart container
5. Verify health endpoint

---

## Development

### Running Migrations
Apply new migrations to the shared RentalCore database:
```bash
mysql -h tsunami-events.de -u tsweb -p RentalCore < migrations/XXX_new_feature.sql
```

### Development Workflow
1. Create feature branch
2. Implement changes
3. Test locally
4. Update README
5. Commit (no AI mentions)
6. Push to GitLab
7. Build Docker image with version tag
8. Push to Docker Hub (version + latest)

### Code Quality Rules
- Never claim finished if not 100% working
- Remove temporary/debug files immediately
- No sensitive data in repository
- Update README after every change
- Professional commit messages (no AI references)
- Clean file management (no _final, _new, _fixed suffixes)

---

## Docker Hub

**Repository:** `nobentie/storagecore`

**Tags:**
- `latest` - Latest stable build
- `1.16` - Complete mobile responsiveness for all pages (current)
- `1.15` - Complete maintenance module with defect tracking and inspections
- `1.14` - Job-based outtake workflow with live scan tracking
- `1.13` - Recursive device count for parent zones
- `1.12` - Two-step intake workflow with zone barcode scanning
- `1.11` - Fixed SPA routing for page reloads
- `1.10` - Fixed zone devices SQL query + subzone delete buttons
- `1.9` - Fixed race condition in bulk shelf creation
- `1.8` - Automatic shelf creation with barcode generation
- `1.7` - Simplified zone types + delete functionality
- `1.6` - Hierarchical zones with auto code generation
- `1.5` - Clean JSON API responses
- `1.4` - Zone creation fix
- `1.3` - Multi-platform API URL support
- `1.2` - Frontend enhancements
- `1.1` - TailwindCSS fixes
- `1.0` - Initial release

**Pull image:**
```bash
docker pull nobentie/storagecore:latest
```

---

## Environment Variables

```env
# Server
PORT=8081
HOST=0.0.0.0

# Database (Shared with RentalCore)
DB_HOST=tsunami-events.de
DB_USER=tsweb
DB_PASS=<password>
DB_NAME=RentalCore
DB_PORT=3306

# Application
APP_ENV=development|production
LOG_LEVEL=info|debug

# CORS
CORS_ORIGIN=*
```

---

## License

Proprietary - Tsunami Events UG

---

## Support

For issues or questions:
- GitLab Issues: https://git.server-nt.de/ntielmann/storagecore/issues
- Internal documentation: See /lager_weidelbach/claude.md

---

**Version:** 1.16
**Last Updated:** 2025-10-15
**Maintainer:** Tsunami Events UG Development Team

---

## Changelog

### Version 1.16 (2025-10-15)
- **Feature: Complete Mobile Responsiveness**
  - Full mobile optimization for all pages and components
  - Professional responsive design with breakpoints at 640px (sm) and 768px (md)
- **Mobile Sidebar:**
  - Hamburger menu with overlay backdrop on mobile
  - Smooth slide-in/out animations
  - Auto-close sidebar on navigation for mobile
  - Desktop: Sidebar visible by default, persists on screen
  - Mobile: Sidebar hidden by default, overlay mode
  - Close button in sidebar header (mobile only)
  - Touch-friendly tap targets
- **Layout Optimizations:**
  - Header: Responsive padding and font sizes (px-3 → px-6, text-lg → text-2xl)
  - Company name hidden on mobile to save space
  - Main content padding adapts (p-3 → p-6)
  - Proper spacing adjustments (pt-14 → pt-16)
- **Dashboard Page:**
  - Stats grid: 1 column on mobile, 2 on sm, 4 on lg
  - Card padding and text sizes scale responsively
  - Icon sizes adjust (w-5 → w-6)
  - Activity feed items with truncation
- **Scan Page:**
  - Scanner icon and titles scale (w-8 → w-12, text-2xl → text-4xl)
  - Step indicator adapts sizing (w-7 → w-8)
  - Input fields with responsive padding
  - Action buttons grid adjusts (gap-2 → gap-4)
  - Result cards with proper text wrapping
- **Devices Page:**
  - Search bar with responsive icon and input sizing
  - Grid: 1 column → 2 columns (sm) → 3 columns (lg)
  - Device cards with flexible layouts
  - Status badges scale properly
  - Truncation for long text
- **Maintenance Page (All 3 Tabs):**
  - **Overview:** Stats in 2-column grid (2 on mobile, 5 on lg)
  - **Defects:** Mobile-friendly form with stacked inputs
  - **Inspections:** Responsive filter tabs with horizontal scroll
  - All cards adapt padding (p-3 → p-6)
  - Text sizes scale across breakpoints
  - Status buttons stack on mobile, inline on desktop
  - Form buttons stack vertically on mobile
- **Mobile-First Features:**
  - Touch-friendly button sizes (44x44px minimum)
  - Proper text wrapping and truncation
  - Overflow-x-auto for filter tabs
  - Flex-wrap for badges and tags
  - Min-w-0 to allow flex item shrinking
  - Line-clamp for multi-line text truncation
- **Responsive Typography:**
  - Headings: text-2xl sm:text-3xl or text-2xl sm:text-4xl
  - Body text: text-xs sm:text-sm or text-sm sm:text-base
  - Badges: text-[10px] sm:text-xs
  - Proper hierarchy maintained across breakpoints
- **Spacing System:**
  - Gaps: gap-2 sm:gap-4, gap-3 sm:gap-6
  - Padding: p-3 sm:p-6, p-4 sm:p-8
  - Margins: mb-1 sm:mb-2, mb-3 sm:mb-4
  - Consistent use of Tailwind spacing scale
- **User Experience:**
  - Smooth transitions for sidebar and modals
  - No horizontal scrolling on any page
  - All interactive elements easily tappable
  - Proper keyboard focus management
  - Maintains glassmorphism aesthetic on all devices
- **Testing Notes:**
  - Tested at breakpoints: 320px, 375px, 768px, 1024px, 1920px
  - Works on iOS Safari, Chrome Mobile, Android Chrome
  - Landscape and portrait orientations supported

### Version 1.15 (2025-10-14)
- **Feature: Complete Maintenance Module Implementation**
  - Full defect tracking and repair management system
  - Inspection scheduling and monitoring
  - Comprehensive maintenance dashboard with real-time statistics
- **Defect Management:**
  - Create defect reports with severity levels (low, medium, high, critical)
  - Status workflow: open → in_progress → repaired → closed
  - Automatic device status updates when defects are created/resolved
  - Inline defect creation form with device ID, severity, title, description
  - Filter defects by status: All, Open, In Progress, Repaired, Closed
  - Color-coded severity badges (critical=red, high=orange, medium=yellow, low=blue)
  - Track repair costs and repair notes
  - Automatic timestamp management (reported_at, repaired_at, closed_at)
  - Status update buttons for workflow progression
- **Inspection Management:**
  - View all inspection schedules with filtering
  - Filter by: All, Overdue, Upcoming (next 30 days)
  - Visual indicators for overdue inspections (red border, "ÜBERFÄLLIG" badge)
  - Display inspection type, interval days, last/next inspection dates
  - Support for both device-specific and product-wide inspections
  - Active/inactive inspection status
- **Maintenance Dashboard:**
  - Overview tab with 5 real-time statistics cards
  - Shows: Open defects, In Progress defects, Repaired defects, Overdue inspections, Upcoming inspections
  - Quick action cards to navigate to defects or inspections
  - Auto-refresh data on view changes
- **Backend API:**
  - `GET /defects` - List defects with filters (status, severity, device_id)
  - `POST /defects` - Create new defect report
  - `PUT /defects/{id}` - Update defect status, costs, notes
  - `GET /maintenance/inspections` - Get inspection schedules (filters: upcoming, overdue, all)
  - `GET /maintenance/stats` - Dashboard statistics
  - Dynamic SQL query building for flexible filtering
  - JOIN queries with devices and products tables for rich data
- **Frontend Features:**
  - New MaintenancePage with three-tab interface (Overview, Defects, Inspections)
  - Real-time data loading with automatic updates
  - Responsive card-based layout with glassmorphism design
  - Color-coded status and severity indicators
  - Inline forms for quick defect creation
  - Status progression buttons for efficient workflow
  - Clock icons with color coding (red=overdue, blue=upcoming)
- **API Types:**
  - New TypeScript interfaces: Defect, Inspection, MaintenanceStats
  - Added maintenanceApi with getStats(), getDefects(), createDefect(), updateDefect(), getInspections()
- **Navigation:**
  - New "Wartung" (Maintenance) menu item with Wrench icon
  - Route: /maintenance
- **Database Integration:**
  - Uses existing tables: defect_reports, inspection_schedules
  - Bi-directional device status updates (defective ↔ in_storage)
  - Full audit trail with timestamps
- **User Workflow:**
  - Defect Reporting:
    1. Navigate to Wartung → Defects tab
    2. Click "Neuer Defekt" to create report
    3. Enter device ID, select severity, add title and description
    4. Submit → Device automatically marked as defective
    5. Track repair progress with status updates
    6. Mark as repaired → Device automatically returns to in_storage
  - Inspection Management:
    1. Navigate to Wartung → Inspections tab
    2. View all scheduled inspections
    3. Filter by overdue or upcoming
    4. See visual indicators for priority
    5. Track last and next inspection dates
- **Use Cases:**
  - Track equipment defects from discovery through repair completion
  - Monitor repair costs and maintenance budgets
  - Ensure timely inspections with overdue alerts
  - Maintain compliance with inspection schedules
  - Full visibility into equipment condition and maintenance needs
  - Historical tracking of all repairs and defects

### Version 1.14 (2025-10-14)
- **Feature: Job-Based Outtake Workflow with Live Scan Tracking**
  - New Jobs page accessible via sidebar navigation (/jobs)
  - Displays all jobs with status "open" ready for device outtake
  - Select a job to start the outtake/packing process
  - Real-time live tracking of which devices have been scanned out
  - Visual progress bar showing scan completion (e.g., 5/20 devices scanned)
  - Two-column layout: Scan interface + Device checklist
  - Auto-refresh every 2 seconds to show live updates as devices are scanned
  - Device list shows checkmarks (✓) for scanned devices, X for remaining
  - Color-coded status: Green for scanned, gray for pending
  - Integration with job_devices table and pack_status tracking
- **Backend Enhancements:**
  - Completely implemented `GetJobs` handler with customer info and device counts
  - Enhanced `GetJobSummary` handler to return full job details with all devices
  - Device list includes current status, location, pack_status, and scan state
  - Scanned flag based on device status ('on_job') or pack_status ('issued')
  - Supports filtering jobs by status (e.g., ?status=open)
  - JOIN queries across jobs, status, customers, jobdevices, devices, products, storage_zones
- **Frontend Features:**
  - New JobsPage component with job selection and scan interface
  - Job cards show: Job ID, description, customer name, dates, device count
  - Job detail view with customer info, dates, and progress statistics
  - Live device checklist with product names, IDs, status, and scan indicators
  - Scan form integrated with job context (sends job_id to scan API)
  - Success/error feedback after each scan
  - "Back to Job List" navigation
  - Auto-refresh for live updates during scanning
- **API Types:**
  - New TypeScript interfaces: Job, JobDevice, JobSummary
  - Added jobsApi.getAll() and jobsApi.getById() functions
- **Navigation:**
  - New "Jobs" menu item with Briefcase icon
  - Route: /jobs
- **User Workflow:**
  1. Navigate to Jobs page
  2. View all open jobs with device counts
  3. Select a job to start packing/outtake
  4. Scan devices one by one
  5. Watch the progress bar and checklist update live
  6. See which devices are still missing at a glance
  7. Complete when all devices are scanned
- **Use Case:**
  - Perfect for warehouse workers preparing equipment for upcoming events
  - Second-level verification that all job devices are physically present
  - Real-time feedback prevents missing items before transport
  - Live updates allow multiple workers to see scan progress simultaneously

### Version 1.13 (2025-10-14)
- **Feature: Recursive Device Count for Parent Zones**
  - Zone device counts now include all devices in subzones recursively
  - When viewing a parent zone (e.g., Lager or Regal), device count shows total across all child zones
  - Implemented using MySQL recursive CTE (Common Table Expression) for efficient querying
  - Example: Lager Weidelbach shows total of all devices in all Regale and all Fächer within
- **Backend Enhancements:**
  - New function `getDeviceCountRecursive` in ZoneService
  - Uses `WITH RECURSIVE` query to build complete zone tree
  - Counts all devices with status 'in_storage' across entire zone hierarchy
  - Updated `GetZoneDetails` to use recursive count
  - Updated `getSubzones` to show recursive counts for each subzone
- **User Benefits:**
  - Accurate inventory totals at every level of the hierarchy
  - No need to manually sum devices across subzones
  - Better overview of warehouse stock distribution
  - Reflects real warehouse organization where parent zones contain all child zone contents

### Version 1.12 (2025-10-14)
- **Feature: Two-Step Intake Workflow with Zone Selection**
  - Implemented multi-step barcode scanning for device intake (Einlagerung)
  - Step 1: Scan device barcode/QR code to verify device exists
  - Step 2: Scan storage location (zone) barcode to specify exact placement
  - Visual step indicator shows progress (Gerät → Lagerplatz)
  - Automatic zone lookup by barcode or zone code
- **Backend Enhancements:**
  - New endpoint: `GET /api/v1/zones/scan?scan_code={code}` - Find zone by barcode/code
  - Enhanced intake process to require and store zone_id
  - Zone barcode support for precise location tracking
- **Frontend Improvements:**
  - Smart UI that adapts based on current step (device vs. zone scan)
  - Different icons and placeholders for each step
  - Action buttons hidden during zone scan step
  - Seamless error handling with automatic step reset
- **User Experience:**
  - Clear visual feedback with step-by-step process
  - Ensures every device is assigned to a specific storage location
  - Prevents devices from being stored without location information
- **Example Workflow:**
  1. Select "Einlagern" action
  2. Scan device barcode → Device verified ✓
  3. Scan zone barcode (e.g., FACH-00000014) → Device stored at specific location
  4. Process complete with full audit trail

### Version 1.11 (2025-10-14)
- **Bug Fix: SPA Routing on Page Reload**
  - Fixed 404 errors when refreshing pages like `/zones`, `/zones/{id}`, etc.
  - Implemented custom `spaHandler` to serve `index.html` for all non-file routes
  - Server now properly handles client-side routing for React Router
  - Changed from `http.FileServer` to custom handler with file existence check
  - All frontend routes now work correctly on direct access or browser refresh

### Version 1.10 (2025-10-14)
- **Bug Fix: Zone Devices SQL Query**
  - Fixed 500 Internal Server Error on `/api/v1/zones/{id}/devices` endpoint
  - Updated query to properly join with `manufacturer` and `brands` tables
  - Changed from direct `p.manufacturer` and `p.model` columns to `m.name` and `b.name` via JOINs
  - Products table uses `manufacturerID` and `brandID` foreign keys, not direct string columns
- **Feature: Subzone Delete Buttons**
  - Added delete buttons to subzone cards in zone detail view
  - Buttons appear on hover, similar to main zones page
  - Click delete without navigating into the subzone
  - Prevents accidental navigation when deleting
  - Confirmation dialog before deletion

### Version 1.9 (2025-10-14)
- **Bug Fix: Race Condition in Bulk Shelf Creation**
  - Fixed duplicate entry errors when creating multiple shelves at once
  - Changed from parallel (Promise.all) to sequential creation
  - Prevents multiple shelves from reading the same count and generating duplicate codes
  - Example: Creating 5 shelves now correctly generates Fach 01-05 instead of all trying to create Fach 01
- **Improved Error Handling:**
  - Eliminated 500 Internal Server errors during bulk operations
  - Consistent shelf numbering without gaps

### Version 1.8 (2025-10-14)
- **Automatic Shelf (Fach) Creation:**
  - Added 📚 **Fach** (shelf) as a 4th zone type for Regalen
  - Automatic name generation (Fach 01, Fach 02, etc.) based on existing shelves in parent rack
  - Automatic barcode generation (FACH-%08d format) after creation
  - No manual name input required for shelf creation
- **Bulk Shelf Creation:**
  - "Fächer erstellen" button in rack detail view
  - Create multiple shelves at once with a single action
  - Default capacity of 10 per shelf
- **Navigation Improvements:**
  - Fixed subzone creation to stay in parent zone context instead of redirecting to /zones
  - Maintains workflow continuity when creating hierarchical structures
- **Database Migration:**
  - Added barcode column to storage_zones table (006_add_zone_barcode.sql)
  - Index on barcode for efficient lookups
- **Backend Enhancements:**
  - GenerateShelfName function in ZoneService for automatic naming
  - Updated CreateZone handler to support optional Name field for shelves
  - Barcode generation logic after zone insertion
- **Example Usage:**
  - Create Lager Weidelbach (WDB)
  - Create Regal A (WDB-RG-01)
  - Click "Fächer erstellen" → Enter "5" → Creates Fach 01 through Fach 05 automatically
  - Each Fach gets codes like WDB-RG-01-F-01 and barcodes like FACH-00000014

### Version 1.7 (2025-10-14)
- **Simplified Zone Types:** Reduced to 3 types only
  - 🏭 **Lager** (warehouse) - Main storage facility
  - 🗄️ **Regal** (rack) - Shelving units
  - 📦 **Gitterbox** (gitterbox) - Wire mesh containers
- **Delete Functionality:**
  - Delete button on zone cards (hover to reveal)
  - Delete button in zone detail view
  - Safety checks: prevents deletion if zone contains devices or subzones
  - Confirmation dialog before deletion
- **Updated Code Generation:**
  - Warehouse prefix: LGR (Lager)
  - Rack prefix: RG (Regal)
  - Gitterbox prefix: GB (Gitterbox)
- **Example Hierarchy:**
  - Weidelbach (WDL) → Regal A (WDL-RG-01) → Gitterbox 01 (WDL-RG-01-GB-01)
- **Database Migration:** Updated ENUM type to support gitterbox

### Version 1.6 (2025-10-14)
- **Automatic Zone Code Generation:** Smart, hierarchical code generation
- **Hierarchical Zone System:** Create nested zones
- **Zone Detail View:** Click zones to see subzones, devices, and breadcrumb navigation
- **ZoneService:** New service layer for zone business logic
- **API Enhancements:**
  - `GET /zones/{id}` returns full details with subzones and breadcrumb
  - `GET /zones/{id}/devices` lists all devices in a zone
  - Optional `code` field in zone creation (auto-generated if not provided)
- **Frontend Improvements:**
  - New ZoneDetailPage component with subzone navigation
  - Parent zone selection in zone creation form
  - Breadcrumb navigation for zone hierarchy
  - Click-to-navigate zone cards

### Version 1.5 (2025-10-14)
- Fixed JSON API responses to return clean primitive types
- Removed nested sql.Null* structures from API responses
- Added ZoneResponse struct for consistent API output
- Fixed React rendering error on zones page
- Updated TypeScript interfaces for nullable fields

### Version 1.4 (2025-10-14)
- Fixed zone creation API endpoint
- Improved JSON request handling with proper nullable field support
- Added detailed logging for zone creation operations

### Version 1.3 (2025-10-14)
- Fixed API URL configuration for multi-platform deployment
- Changed from absolute to relative URLs for cross-platform compatibility

### Version 1.2 (2025-10-14)
- Frontend glassmorphism enhancements
- Improved device and zone display components

### Version 1.1 (2025-10-14)
- Fixed TailwindCSS v4 configuration
- Updated PostCSS plugins for modern build system

### Version 1.0 (2025-10-14)
- Initial release with core warehouse management features
- Scan-driven workflows implementation
- Modern React + TypeScript frontend with glassmorphism design
