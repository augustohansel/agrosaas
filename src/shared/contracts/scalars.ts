/** Formatos JSON expostos pelo PostgREST. Numeric é calculado no banco. */
export type UUID = string;
export type Timestamp = string;
export type LocalDate = string;
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type InputFamily = 'seed' | 'pesticide' | 'fertilizer' | 'adjuvant' | 'fuel';
export type JobKind = 'planting' | 'spraying' | 'fertilizing' | 'harvesting';
export type JobState = 'planned' | 'running' | 'completed' | 'cancelled';
export type MeterKind = 'hours' | 'km';
export type StorageKind = 'silo' | 'cooperative' | 'trader';
export type BillKind = 'payable' | 'receivable';
export type CostBasis = 'direct' | 'inventory' | 'equipment' | 'sale' | 'other';
export type StockEvent = 'receipt' | 'work_order' | 'refuel';
