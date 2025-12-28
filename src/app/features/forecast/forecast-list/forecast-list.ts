import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';

import { ForecastRecordService } from '../forecast-record/forecast-record/forecast-record.service';
import { ForecastRecord } from '../forecast-record/models/forecast-record.model';

@Component({
  selector: 'app-forecast-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './forecast-list.html',
  styleUrls: ['./forecast-list.css'],
})
export class ForecastListComponent {
  private readonly service = inject(ForecastRecordService);

  records$: Observable<ForecastRecord[]> = this.service.list();

  refresh(): void {
    this.records$ = this.service.list();
  }
}
