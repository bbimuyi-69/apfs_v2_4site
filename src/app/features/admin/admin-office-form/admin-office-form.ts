import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApfsOrganizationService } from 'src/app/core/services/apfs-organization.service';
import { ApfsOfficeService, OfficeRow } from 'src/app/core/services/apfs-offices.service';
import { getOfficePermissionName } from 'src/app/features/admin/admin-offices/admin-offices'; // for getOfficePermissionName helper

type OfficeFormModel = {
  name: FormControl<string>;
  full_name: FormControl<string>;
  organization_id: FormControl<number | null>;
  office_assignment_permissions_level_id: FormControl<number | null>;
  aac_code: FormControl<string>;
  active: FormControl<0 | 1>;
};

@Component({
  selector: 'app-admin-office-form',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './admin-office-form.html',
  styleUrls: ['./admin-office-form.css'],
})
export class AdminOfficeFormComponent implements OnInit {
  getOfficePermissionName = getOfficePermissionName;
  permissionOptions = [
    { id: 1, label: 'Requirements' },
    { id: 2, label: 'Contracting' },
    { id: 3, label: 'Coordinator' },
    { id: 4, label: 'Admin' }
  ];

  private readonly officeSvc = inject(ApfsOfficeService);
  private readonly orgSvc = inject(ApfsOrganizationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  mode: 'create' | 'edit' = 'create';
  officeId: number | null = null;

  isLoading = false;
  isSaving = false;
  error: string | null = null;

  // Organization dropdown options (id + full_name)
  organizations: { id: number; label: string }[] = [];

  form = new FormGroup<OfficeFormModel>({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    full_name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    organization_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    office_assignment_permissions_level_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    aac_code: new FormControl('', { nonNullable: true }),
    active: new FormControl<0 | 1>(1, { nonNullable: true }),
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.officeId = idParam ? Number(idParam) : null;
    this.mode = this.officeId ? 'edit' : 'create';

    this.loadOrganizations();

    if (this.mode === 'edit' && this.officeId) {
      this.loadOffice(this.officeId);
    }
  }

  get titleText(): string {
    return this.mode === 'edit' ? 'Edit Office' : 'Add Office';
  }

  get subtitleText(): string {
    return this.mode === 'edit'
      ? 'Update office details and status.'
      : 'Create a new office under an organization.';
  }

  loadOrganizations(): void {
    // Uses your existing options style endpoint: /public/apfs-organization/options
    // Your orgSvc.getOrganizations({ activeOnly: false }) is fine too.
    this.orgSvc.getOrganizations({ activeOnly: false }).subscribe({
      next: (list: any[]) => {
        this.organizations = (list ?? [])
          .map(x => ({
            id: Number(x.id),
            label: String(x.full_name ?? '').trim(),
          }))
          .filter(x => Number.isFinite(x.id) && !!x.label)
          .sort((a, b) => a.label.localeCompare(b.label));
      },
      error: () => {
        // Not fatal—user could still type id if you allow it, but dropdown will be empty.
        this.organizations = [];
      },
    });
  }



  loadOffice(id: number): void {
    this.isLoading = true;
    this.error = null;

    this.officeSvc.get(id).subscribe({
      next: (o: OfficeRow) => {
        this.form.patchValue({
          name: o.name ?? '',
          full_name: o.full_name ?? '',
          organization_id: o.organization_id ?? null,
          office_assignment_permissions_level_id: o.office_assignment_permissions_level_id ?? null,
          aac_code: o.aac_code ?? '',
          active: o.active === 0 ? 0 : 1,
        });
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Failed to load office.';
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

    const orgId = this.form.controls.organization_id.value;
    const permId = this.form.controls.office_assignment_permissions_level_id.value;

    if (orgId == null || permId == null) {
      // Shouldn't happen if validators are working, but keeps TS happy + safe
      this.error = 'Organization and Assignment Level are required.';
      return;
    }

    const payload: Partial<OfficeRow> = {
      name: this.form.controls.name.value.trim(),
      full_name: this.form.controls.full_name.value.trim(),
      organization_id: orgId,
      office_assignment_permissions_level_id: permId,
      aac_code: this.form.controls.aac_code.value.trim(),
      active: this.form.controls.active.value
    };

    const req$ =
      this.mode === 'edit' && this.officeId
        ? this.officeSvc.update(this.officeId, payload)
        : this.officeSvc.create(payload);

    req$.subscribe({
      next: () => {
        this.isSaving = false;
        this.router.navigateByUrl('/admin/offices');
      },
      error: () => {
        this.error = 'Save failed. Please try again.';
        this.isSaving = false;
      },
    });
  }

  cancel(): void {
    this.router.navigateByUrl('/admin/offices');
  }

  showError(controlName: keyof OfficeFormModel): boolean {
    const c = this.form.controls[controlName];
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
