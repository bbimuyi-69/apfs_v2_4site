import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardFilters } from '../../models/dashboard-v2.models';

@Component({
  selector: 'app-dashboard-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-filters.component.html',
  styleUrl: './dashboard-filters.component.css',
})
export class DashboardFiltersComponent {
  @Input() value!: DashboardFilters;
  @Output() valueChange = new EventEmitter<DashboardFilters>();

  patch(p: Partial<DashboardFilters>){
    this.valueChange.emit({ ...this.value, ...p });
  }

  reset(){
    this.valueChange.emit({
      q: '',
      status: 'All',
      sort: 'updated_desc',
      mineClaimed: false,
      mineSubmitted: false,
    });
  }
}
