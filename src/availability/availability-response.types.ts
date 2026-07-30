import { AvailabilityType } from './availability-type.enum';
import {
  DayOfWeek,
  SchedulingType,
} from './entities/recurring-availability.entity';

export interface RecurringAvailabilityResponse {
  id: string;
  availabilityType: AvailabilityType.RECURRING;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  schedulingType: SchedulingType;
  maxCapacity: number;
  slotDuration?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomAvailabilityResponse {
  id: string;
  availabilityType: AvailabilityType.CUSTOM;
  date: string;
  startTime: string;
  endTime: string;
  schedulingType: SchedulingType;
  maxCapacity: number;
  slotDuration?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringAvailabilityWithSummary extends RecurringAvailabilityResponse {
  summary: string;
}

export interface CustomAvailabilityWithSummary extends CustomAvailabilityResponse {
  summary: string;
}

export interface AvailabilityByDateCustomResponse {
  date: string;
  availabilityType: AvailabilityType.CUSTOM;
  availability: CustomAvailabilityResponse[];
}

export interface AvailabilityByDateRecurringResponse {
  date: string;
  availabilityType: AvailabilityType.RECURRING;
  dayOfWeek: DayOfWeek;
  availability: RecurringAvailabilityResponse[];
}

export interface AvailabilityByDateEmptyResponse {
  date: string;
  availabilityType: null;
  message: string;
}

export type AvailabilityByDateResponse =
  | AvailabilityByDateCustomResponse
  | AvailabilityByDateRecurringResponse
  | AvailabilityByDateEmptyResponse;
