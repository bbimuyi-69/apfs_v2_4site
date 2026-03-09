import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApfsOfficeService, OfficeRow } from 'src/app/core/services/apfs-offices.service';

@Component({
  selector: 'app-admin-offices',
  templateUrl: './admin-offices.html',
  styleUrls: ['./admin-offices.css'],
  standalone: true,
  imports: [CommonModule,
    ReactiveFormsModule,
    RouterModule]
})
export class AdminOfficesComponent implements OnInit {
  getOfficePermissionName = getOfficePermissionName;

  rows: OfficeRow[] = [];
  filteredRows: OfficeRow[] = [];

  q = new FormControl('');
  isLoading = false;
  error: string | null = null;

  constructor(private officeService: ApfsOfficeService, private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.load();

    this.q.valueChanges.subscribe(() => {
      this.applyFilter();
    });
  }

  load() {
    this.isLoading = true;
    this.error = null;

    this.officeService.list({ active: 1 }).subscribe({
      next: (data) => {
        this.rows = data;
        this.applyFilter();
        this.isLoading = false;

        // ✅ force UI refresh when needed (esp. OnPush)
        this.cdr.markForCheck();     // preferred
        // this.cdr.detectChanges();  // use only if markForCheck doesn't cut it
      },
      error: () => {
        this.error = 'Failed to load offices.';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }


  applyFilter() {
    const term = (this.q.value || '').toLowerCase().trim();

    if (!term) {
      this.filteredRows = [...this.rows];
      return;
    }

    this.filteredRows = this.rows.filter(r =>
      r.full_name.toLowerCase().includes(term) ||
      r.name.toLowerCase().includes(term) ||
      (r.aac_code || '').toLowerCase().includes(term)
    );
  }

  clearSearch() {
    this.q.setValue('');
  }
}


export function getOfficePermissionName(id: number | null | undefined): string {
  switch (Number(id)) {
    case 1:
      return 'Requirements';
    case 2:
      return 'Contracting';
    case 3:
      return 'Coordinator';
    case 4:
      return 'Admin';
    default:
      return 'Unknown';
  }
}
