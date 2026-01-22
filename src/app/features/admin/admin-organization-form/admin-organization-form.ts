import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApfsOrganizationService, ApfsOrganizationNode } from 'src/app/core/services/apfs-organization.service';

type OrgFormModel = {
  full_name: FormControl<string>;
  name: FormControl<string>;
  acronym: FormControl<string>;
  parent_id: FormControl<number | null>;
  active: FormControl<0 | 1>;
};

@Component({
  selector: 'app-admin-organization-form',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './admin-organization-form.html',
  styleUrls: ['./admin-organization-form.css'],
})
export class AdminOrganizationFormComponent implements OnInit {
  private readonly orgSvc = inject(ApfsOrganizationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  mode: 'create' | 'edit' = 'create';
  orgId: number | null = null;

  isLoading = false;
  isSaving = false;
  error: string | null = null;

  // For Parent dropdown (flat list, label/value)
  parents: { id: number; label: string; active: 0 | 1 }[] = [];

  form = new FormGroup<OrgFormModel>({
    full_name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true }),
    acronym: new FormControl('', { nonNullable: true }),
    parent_id: new FormControl<number | null>(null),
    active: new FormControl<0 | 1>(1, { nonNullable: true }),
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.orgId = idParam ? Number(idParam) : null;
    this.mode = this.orgId ? 'edit' : 'create';

    this.loadParents();

    if (this.mode === 'edit' && this.orgId) {
      this.loadOrg(this.orgId);
    }
  }

  get titleText(): string {
    return this.mode === 'edit' ? 'Edit Organization' : 'Add Organization';
  }

  get subtitleText(): string {
    return this.mode === 'edit'
      ? 'Update organization details and status.'
      : 'Create a new organization in the hierarchy.';
  }

  loadParents(): void {
    // We want active + inactive visible for admin parenting decisions.
    // Uses scoped tree and flattens. (If your endpoint doesn’t return inactive yet, it will still work for active-only.)
    this.orgSvc.getOrganizations({ activeOnly: false }).subscribe({
      next: (list: any[]) => {
        // list only has id + full_name currently; we’ll populate label.
        this.parents = (list ?? []).map(x => ({
          id: x.id,
          label: x.full_name,
          active: 1, // if you later return active, use that
        }));
      },
      error: () => {
        // Not fatal—user can still create without parent.
        this.parents = [];
      },
    });
  }

  loadOrg(id: number): void {
    this.isLoading = true;
    this.error = null;

    this.orgSvc.getById(id).subscribe({
      next: (o) => {
        this.form.patchValue({
          full_name: o.full_name ?? '',
          name: o.name ?? '',
          acronym: o.acronym ?? '',
          parent_id: o.parent_id ?? null,
          active: o.active === 0 ? 0 : 1,
        });
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Failed to load organization.';
        this.isLoading = false;
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.error = null;

    const payload = {
      full_name: this.form.controls.full_name.value.trim(),
      name: this.form.controls.name.value.trim(),
      acronym: this.form.controls.acronym.value.trim(),
      parent_id: this.form.controls.parent_id.value,
      active: this.form.controls.active.value,
    };

    const req$ =
      this.mode === 'edit' && this.orgId
        ? this.orgSvc.update(this.orgId, payload)
        : this.orgSvc.create(payload);

    req$.subscribe({
      next: () => {
        this.isSaving = false;
        this.router.navigateByUrl('/admin/organization');
      },
      error: () => {
        this.error = 'Save failed. Please try again.';
        this.isSaving = false;
      },
    });
  }

  cancel(): void {
    this.router.navigateByUrl('/admin/organization');
  }

  // Tiny helper if you want template error display parity
  showError(controlName: keyof OrgFormModel): boolean {
    const c = this.form.controls[controlName];
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
