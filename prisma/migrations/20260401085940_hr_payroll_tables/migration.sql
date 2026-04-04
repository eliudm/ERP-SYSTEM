-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'UNPAID');

-- CreateTable
CREATE TABLE "payrolls" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "totalGross" DECIMAL(18,2) NOT NULL,
    "totalPaye" DECIMAL(18,2) NOT NULL,
    "totalNhif" DECIMAL(18,2) NOT NULL,
    "totalNssf" DECIMAL(18,2) NOT NULL,
    "totalNet" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_lines" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossSalary" DECIMAL(18,2) NOT NULL,
    "payeAmount" DECIMAL(18,2) NOT NULL,
    "nhifAmount" DECIMAL(18,2) NOT NULL,
    "nssfAmount" DECIMAL(18,2) NOT NULL,
    "netSalary" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payrolls_month_year_key" ON "payrolls"("month", "year");

-- AddForeignKey
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
