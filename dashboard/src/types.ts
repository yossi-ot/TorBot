export interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  source: string;
  notes: string | null;
  createdAt: string;
  customer: { id: string; name: string | null; phone: string };
  service: { id: string; name: string; price: number; durationMinutes: number };
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  durationMinutes: number;
  price: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
}

export interface WorkingHour {
  id: string;
  tenantId: string;
  staffId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface BlockedSlot {
  id: string;
  tenantId: string;
  staffId: string | null;
  startDatetime: string;
  endDatetime: string;
  reason: string | null;
}

export interface Stats {
  totalAppointments: number;
  confirmedCount: number;
  cancelledCount: number;
  completedCount: number;
  noShowCount: number;
  totalRevenue: number;
  popularServices: Array<{ name: string; count: number; revenue: number }>;
  dailyCounts: Array<{ date: string; count: number }>;
  newCustomers: number;
}
