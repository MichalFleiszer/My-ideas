
export enum OrderStatus {
  RECEIVED = 'PRZYJĘTO',
  DIAGNOSIS = 'DIAGNOZA',
  WAITING_PARTS = 'CZEKA NA CZĘŚCI',
  IN_PROGRESS = 'W TRAKCIE',
  READY = 'GOTOWE DO ODBIORU',
  COMPLETED = 'ZAKOŃCZONE',
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type: 'INDIVIDUAL' | 'COMPANY';
  nip?: string;
  notes?: string;
  createdAt: number;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: number;
}

export interface Order {
  id: string;
  customerId: string;
  deviceName: string; // e.g. "Wiertarka Bosch GSB 13"
  serialNumber?: string;
  issueDescription: string;
  diagnosis?: string;
  status: OrderStatus;
  history?: StatusHistoryEntry[];
  estimatedCost?: number;
  finalCost?: number;
  createdAt: number;
  updatedAt: number;
  technicianNotes?: string;
}

export type ViewState = 'DASHBOARD' | 'CUSTOMERS' | 'ORDERS' | 'NEW_ORDER' | 'TEMPLATES' | 'CLIENT_PORTAL';

export interface NotificationTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
  type: 'SMS' | 'EMAIL';
}
