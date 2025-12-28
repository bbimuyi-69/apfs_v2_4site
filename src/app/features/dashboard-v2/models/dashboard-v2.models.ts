import { ForecastRecordStatus } from '../../forecast/forecast-record/models/forecast-record.model';

export type DashboardStatus = ForecastRecordStatus | 'All';

export interface StatusCount {
  status: ForecastRecordStatus;
  count: number;
}

export interface DashboardFilters {
  q: string;
  status: DashboardStatus;
  sort: 'updated_desc' | 'updated_asc';
  mineClaimed: boolean;
  mineSubmitted: boolean;
}
