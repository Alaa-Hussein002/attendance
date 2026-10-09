-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER', 'HR', 'EMPLOYEE', 'PHOTOGRAPHER', 'TEAM_LEAD');

-- CreateEnum
CREATE TYPE "CheckInSource" AS ENUM ('GPS', 'NETWORK', 'FINGERPRINT', 'MANUAL', 'TASK');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('SCHEDULED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "radiusMeters" INTEGER,
    "allowedIpRanges" TEXT[],
    "verificationModes" "CheckInSource"[],
    "policyId" TEXT,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "tracksAttendance" BOOLEAN NOT NULL DEFAULT true,
    "biometricId" TEXT,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "baseSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "policyId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceUid" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "clientTime" TIMESTAMP(3),
    "source" "CheckInSource" NOT NULL,
    "status" TEXT NOT NULL,
    "ip" TEXT,
    "deviceUid" TEXT,
    "taskId" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "flags" TEXT[],

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySummary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "policyId" TEXT,
    "policyConfig" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceUid" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceUid" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Excuse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Excuse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcuseRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcuseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricDevice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'ZKTECO',
    "model" TEXT,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 4370,
    "serialNumber" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "notes" TEXT,
    "apiKeyHash" TEXT,
    "clockOffsetMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 150,
    "address" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "phoneNumberId" TEXT,
    "businessAccountId" TEXT,
    "accessTokenEnc" TEXT,
    "templateDaily" TEXT,
    "templateReminder" TEXT,
    "templateAssigned" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PunchLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "biometricId" TEXT NOT NULL,
    "punchedAtLocal" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "userId" TEXT,
    "result" TEXT NOT NULL,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PunchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Device_userId_deviceUid_key" ON "Device"("userId", "deviceUid");

-- CreateIndex
CREATE INDEX "AttendanceRecord_companyId_localDate_idx" ON "AttendanceRecord"("companyId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_userId_localDate_key" ON "AttendanceRecord"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_companyId_date_key" ON "Holiday"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySummary_userId_year_month_key" ON "MonthlySummary"("userId", "year", "month");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_at_idx" ON "AuditLog"("companyId", "at");

-- CreateIndex
CREATE INDEX "AttendancePolicy_companyId_isDefault_idx" ON "AttendancePolicy"("companyId", "isDefault");

-- CreateIndex
CREATE INDEX "OtpChallenge_userId_createdAt_idx" ON "OtpChallenge"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Excuse_userId_localDate_key" ON "Excuse"("userId", "localDate");

-- CreateIndex
CREATE INDEX "ExcuseRequest_companyId_status_idx" ON "ExcuseRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "ExcuseRequest_userId_localDate_idx" ON "ExcuseRequest"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricDevice_apiKeyHash_key" ON "BiometricDevice"("apiKeyHash");

-- CreateIndex
CREATE INDEX "BiometricDevice_companyId_branchId_idx" ON "BiometricDevice"("companyId", "branchId");

-- CreateIndex
CREATE INDEX "Task_companyId_startsAt_idx" ON "Task"("companyId", "startsAt");

-- CreateIndex
CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignee_taskId_userId_key" ON "TaskAssignee"("taskId", "userId");

-- CreateIndex
CREATE INDEX "NotificationLog_companyId_createdAt_idx" ON "NotificationLog"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_userId_kind_refKey_channel_key" ON "NotificationLog"("userId", "kind", "refKey", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappConfig_companyId_key" ON "WhatsappConfig"("companyId");

-- CreateIndex
CREATE INDEX "PunchLog_companyId_localDate_idx" ON "PunchLog"("companyId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "PunchLog_deviceId_biometricId_punchedAtLocal_key" ON "PunchLog"("deviceId", "biometricId", "punchedAtLocal");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AttendancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AttendancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySummary" ADD CONSTRAINT "MonthlySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excuse" ADD CONSTRAINT "Excuse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcuseRequest" ADD CONSTRAINT "ExcuseRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchLog" ADD CONSTRAINT "PunchLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
