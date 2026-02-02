import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';

import { ApfsOrganizationService, ApfsOrganizationNode } from 'src/app/core/services/apfs-organization.service';
import { debounceTime, startWith } from 'rxjs/operators';
import { ChangeDetectorRef } from '@angular/core';

type FlatOrgRow = {
  id: number;
  name: string;
  acronym: string;
  full_name: string;
  active: 0 | 1;
  parent_id: number | null;
  level: number;
};

@Component({
  selector: 'app-admin-organization',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule], // ✅ add ReactiveFormsModule
  templateUrl: './admin-organization.html',
  styleUrls: ['./admin-organization.css'],
})
export class AdminOrganization implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly orgSvc = inject(ApfsOrganizationService);

  isLoading = false;
  error: string | null = null; // optional, but your template likely shows it

  rows: FlatOrgRow[] = [];

  q = new FormControl<string>('', { nonNullable: true }); // ✅ typed + non-null
  filteredRows: FlatOrgRow[] = []; // ✅ type it

  ngOnInit(): void {
    // Load data on entry (optional, but typical)
    this.load();

    // Keep filteredRows in sync with search text
    this.q.valueChanges
      .pipe(startWith(this.q.value), debounceTime(150))
      .subscribe(term => this.applyFilter(term));
  }

  load(): void {
    this.isLoading = true;
    this.error = null;

    this.orgSvc.getScopedTree({ activeOnly: true }).subscribe({
      next: (tree) => {
        const roots = Array.isArray(tree) ? tree : [tree];
        this.rows = [...this.flattenTree(roots)];
        this.applyFilter(this.q.value);

        this.isLoading = false;
        this.cdr.markForCheck(); // ✅ force repaint if parent is OnPush
      },
      error: () => {
        this.error = 'Failed to load organizations.';
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private applyFilter(term: string) {
    const q = (term ?? '').toLowerCase().trim();

    if (!q) {
      this.filteredRows = [...this.rows];   // ✅ new reference
      return;
    }

    this.filteredRows = this.rows.filter(r =>
      (r.full_name || r.name || '').toLowerCase().includes(q) ||
      (r.acronym || '').toLowerCase().includes(q)
    );
  }


  clearSearch() {
    this.q.setValue('');

  }

  private flattenTree(
    nodes: ApfsOrganizationNode[],
    level = 0,
    out: FlatOrgRow[] = []
  ): FlatOrgRow[] {
    for (const n of nodes) {
      out.push({
        id: n.id,
        name: n.name,
        acronym: n.acronym,
        full_name: n.full_name,
        active: n.active,
        parent_id: n.parent_id,
        level,
      });
      if (n.children?.length) this.flattenTree(n.children, level + 1, out);
    }
    return out;
  }
}
