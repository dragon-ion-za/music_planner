export interface Song {
  number: string;
  hymnal: string;
  translationOf?: { number: string };
}

export interface SlotTemplate {
  slotKey: string;
  category: 'orchestra' | 'choir' | 'congregation';
  displayOrder: number;
}

export interface ServiceSlot {
  id: string;
  serviceId: string;
  slotTemplateId: string;
  songId: string | null;
  slotTemplate: SlotTemplate;
  song: Song | null;
}

export interface Service {
  id: string;
  congregationId: string;
  serviceDate: string; // YYYY-MM-DD
  serviceType: string;
  serviceSlots: ServiceSlot[];
}

export interface SlotInput {
  slotKey: string;
  songId: string | null;
}

export interface SlotConflictStatus {
  severity: 'red' | 'yellow' | 'green' | null;
  conflictingDates: Array<{ date: string; serviceType: string }>;
}

export type ConflictMap = Record<string, SlotConflictStatus>;

export interface ServiceSlotViewModel extends ServiceSlot {
  canonicalNumber: string;
}

export interface SlotGroup {
  category: 'orchestra' | 'choir' | 'congregation';
  slots: ServiceSlotViewModel[];
}

export interface ServiceViewModel extends Service {
  serviceSlots: ServiceSlotViewModel[];
  slotGroups: SlotGroup[];
}

export interface MonthState {
  displayMonth: any; // moment.Moment
  displayFrom: string;
  displayTo: string;
  conflictFrom: string;
  conflictTo: string;
}
