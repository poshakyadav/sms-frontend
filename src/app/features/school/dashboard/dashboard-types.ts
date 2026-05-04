// src/app/features/school/dashboard/dashboard.types.ts

export interface DashboardStat {
    label: string;
    value: number | string;
    key: string; // The raw key from backend
    icon?: string;
    colorClass?: string;
  }
  
  export interface DashboardList {
    title: string;
    message?: string;
    createdAt?: string;
    dueDate?: string;
    class?: string;
    subject?: string;
    section?: string;
  }
  
  export interface DashboardData {
    role: string;
    stats: Record<string, number | string>;
    lists: Record<string, DashboardList[]>;
    quickLinks: string[];
  }