import { ForecastWorkflowLane } from '../../forecast/forecast-record/models/forecast-record.enums';

export type DashboardStatus = ForecastWorkflowLane | 'All';

export interface StatusCount {
  status: ForecastWorkflowLane;
  count: number;
}

export interface DashboardFilters {
  q: string;
  status: DashboardStatus;
  sort: 'updated_desc' | 'updated_asc';
  mineClaimed: boolean;
  mineSubmitted: boolean;
}
