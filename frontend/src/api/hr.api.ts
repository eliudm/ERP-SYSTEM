import { apiClient } from './client';

export const hrApi = {
  getEmployees: async (search?: string, department?: string) => {
    const res = await apiClient.get('/hr/employees', { params: { search, department } });
    return res.data;
  },
  createEmployee: async (data: any) => {
    const res = await apiClient.post('/hr/employees', data);
    return res.data;
  },
  getHeadcount: async () => {
    const res = await apiClient.get('/hr/employees/headcount');
    return res.data;
  },
  getPayrolls: async () => {
    const res = await apiClient.get('/hr/payroll');
    return res.data;
  },
  generatePayroll: async (data: any) => {
    const res = await apiClient.post('/hr/payroll/generate', data);
    return res.data;
  },
  approvePayroll: async (id: string) => {
    const res = await apiClient.patch(`/hr/payroll/${id}/approve`);
    return res.data;
  },
  markPayrollPaid: async (id: string) => {
    const res = await apiClient.patch(`/hr/payroll/${id}/paid`);
    return res.data;
  },
  getPayrollDetail: async (id: string) => {
    const res = await apiClient.get(`/hr/payroll/${id}`);
    return res.data;
  },
  getLeaveRequests: async (status?: string) => {
    const res = await apiClient.get('/hr/leave', { params: { status } });
    return res.data;
  },
  createLeave: async (data: any) => {
    const res = await apiClient.post('/hr/leave', data);
    return res.data;
  },
  approveLeave: async (id: string) => {
    const res = await apiClient.patch(`/hr/leave/${id}/approve`);
    return res.data;
  },
  rejectLeave: async (id: string) => {
    const res = await apiClient.patch(`/hr/leave/${id}/reject`);
    return res.data;
  },

  // Attendance
  getAttendance: async (employeeId?: string, startDate?: string, endDate?: string) => {
    const res = await apiClient.get('/hr/attendance', { params: { employeeId, startDate, endDate } });
    return res.data;
  },
  recordAttendance: async (data: any) => {
    const res = await apiClient.post('/hr/attendance/clock-in', data);
    return res.data;
  },
  checkOut: async (employeeId: string, notes?: string) => {
    const res = await apiClient.post('/hr/attendance/clock-out', { employeeId, notes });
    return res.data;
  },

  // Recruitment
  getApplications: async (jobPostingId?: string, status?: string) => {
    const res = await apiClient.get('/hr/recruitment/applications', { params: { jobPostingId, status } });
    return res.data;
  },
  createApplication: async (data: any) => {
    const res = await apiClient.post('/hr/recruitment/applications', data);
    return res.data;
  },
  advanceStage: async (id: string, action: 'shortlist' | 'reject' | 'offer' | 'hire', hireData?: any) => {
    const res = await apiClient.post(`/hr/recruitment/applications/${id}/${action}`, hireData ?? {});
    return res.data;
  },

  // Appraisals
  getAppraisals: async (employeeId?: string) => {
    const res = await apiClient.get('/hr/appraisals', { params: { employeeId } });
    return res.data;
  },
  createAppraisal: async (data: any) => {
    const res = await apiClient.post('/hr/appraisals', data);
    return res.data;
  },
  submitAppraisal: async (id: string) => {
    const res = await apiClient.post(`/hr/appraisals/${id}/submit`);
    return res.data;
  },

  // Allowances & Loans
  getAllowances: async (employeeId?: string) => {
    const res = await apiClient.get('/hr/allowances', { params: { employeeId } });
    return res.data;
  },
  createAllowance: async (data: any) => {
    const res = await apiClient.post('/hr/allowances', data);
    return res.data;
  },
  deleteAllowance: async (id: string) => {
    await apiClient.delete(`/hr/allowances/${id}`);
  },
  getLoans: async (employeeId?: string) => {
    const res = await apiClient.get('/hr/loans', { params: { employeeId } });
    return res.data;
  },
  createLoan: async (data: any) => {
    const res = await apiClient.post('/hr/loans', data);
    return res.data;
  },
};
