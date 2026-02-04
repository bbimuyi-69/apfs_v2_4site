import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models/user.model';
import { ApfsDropdownsService } from '../../../core/services/apfs-dropdowns.service';
import { ApfsOrganizationService } from '../../../core/services/apfs-organization.service';

type ApfsOrganization = { id: number; full_name: string };

@Component({
  selector: 'app-request-new-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './request-new-user-form.html',
  styleUrls: ['./request-new-user-form.css'],
})
export class RequestNewUserForm implements OnInit {
  requestNewUserForm!: FormGroup;

  users: User[] = [];
  submissionSuccess = false;
  submissionError = '';
  isSubmitting = false;

  employeeTypes: string[] = [];

  /**
   * NOTE: we keep this property name to avoid touching your HTML.
   * It will contain organization.full_name values (CBP, DHS HQ, etc).
   */
  components: string[] = [];

  roleOptions: string[] = [];
  officeOptions: string[] = [];

  // org list + lookup (full_name -> id)
  organizations: ApfsOrganization[] = [];
  private readonly orgIdByName = new Map<string, number>();

  // org load UX
  orgsLoading = false;
  orgsLoadError = '';

  // Edit mode
  isEditMode = false;
  editingUserId: number | null = null;
  private readonly route = inject(ActivatedRoute);

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private dropdowns: ApfsDropdownsService,
    private orgService: ApfsOrganizationService
  ) { }

  ngOnInit(): void {
    console.log('[RequestNewUserForm] route id =', this.route.snapshot.paramMap.get('id'));

    this.requestNewUserForm = this.fb.group({
      id: [''],

      title: ['', Validators.required],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],

      employeeType: ['', Validators.required],

      // holds organization full_name (phase 1)
      component: ['', Validators.required],

      role: ['', Validators.required],
      office: ['', Validators.required],

      isActive: [false],
    });

    // Dependent dropdown logic
    const roleCtrl = this.requestNewUserForm.get('role')!;
    const officeCtrl = this.requestNewUserForm.get('office')!;

    const updateRoleEnabled = () => {
      const hasEmployeeType = !!this.requestNewUserForm.get('employeeType')!.value;
      hasEmployeeType ? roleCtrl.enable({ emitEvent: false }) : roleCtrl.disable({ emitEvent: false });
    };

    const updateOfficeEnabled = () => {
      const hasComponent = !!this.requestNewUserForm.get('component')!.value;
      const hasRole = !!this.requestNewUserForm.get('role')!.value;
      hasComponent && hasRole ? officeCtrl.enable({ emitEvent: false }) : officeCtrl.disable({ emitEvent: false });
    };

    // Defaults
    updateRoleEnabled();
    updateOfficeEnabled();

    // Base lists
    this.dropdowns.getEmployeeTypes().subscribe((list: string[]) => (this.employeeTypes = list ?? []));

    // ✅ Organizations drive the "component" dropdown (phase 1)
    this.loadOrganizations();

    // Helpers
    const clearRole = () => {
      this.roleOptions = [];
      this.requestNewUserForm.get('role')!.setValue('');
    };

    const clearOffice = () => {
      this.officeOptions = [];
      this.requestNewUserForm.get('office')!.setValue('');
    };

    const reloadOfficesIfReady = () => {
      const component = String(this.requestNewUserForm.get('component')!.value || '').trim();
      const role = String(this.requestNewUserForm.get('role')!.value || '').trim();
      if (!component || !role) {
        clearOffice();
        return;
      }

      this.dropdowns.getOfficesForComponentRole(component, role).subscribe((offices: string[]) => {
        this.officeOptions = offices ?? [];

        // If current office no longer valid, clear it
        const currentOffice = this.requestNewUserForm.get('office')!.value;
        if (!this.officeOptions.includes(currentOffice)) {
          this.requestNewUserForm.get('office')!.setValue('');
        }
      });
    };

    // 1) employeeType -> roles (and reset downstream)
    this.requestNewUserForm.get('employeeType')!.valueChanges.subscribe((employeeType: string) => {
      clearRole();
      clearOffice();

      updateRoleEnabled();
      updateOfficeEnabled();

      const et = String(employeeType || '').trim();
      if (!et) return;

      this.dropdowns.getRolesForEmployeeType(et).subscribe((roles: string[]) => {
        this.roleOptions = roles ?? [];
      });
    });

    // 2) component changes -> clear office then reload offices if role already chosen
    this.requestNewUserForm.get('component')!.valueChanges.subscribe(() => {
      clearOffice();
      updateOfficeEnabled();
      reloadOfficesIfReady();
    });

    // 3) role changes -> clear office then reload offices if component already chosen
    this.requestNewUserForm.get('role')!.valueChanges.subscribe(() => {
      clearOffice();
      updateOfficeEnabled();
      reloadOfficesIfReady();
    });

    // Users list + edit-mode hydrate
    this.userService.getUsers().subscribe({
      next: (data: User[]) => {
        this.users = data ?? [];

        const idParam = this.route.snapshot.paramMap.get('id');
        const id = idParam ? Number(idParam) : NaN;

        if (Number.isFinite(id)) {
          const u = this.users.find(x => Number(x.id) === id);
          if (u) this.hydrateForEdit(u);

          this.updateComponentEnabled();
          updateRoleEnabled();
          updateOfficeEnabled();
        }

        this.cdr.detectChanges();
      },
      error: (error) => console.error('Error fetching users:', error),
    });
  }

  private loadOrganizations(): void {
    this.orgsLoading = true;
    this.orgsLoadError = '';

    // If you used the updated org service, this will:
    // - use scoped tree for logged-in Admins
    // - fall back to public options for anonymous users
    this.orgService.getOrganizations({ activeOnly: true }).subscribe({
      next: (orgs: ApfsOrganization[]) => {
        this.orgsLoading = false;

        this.organizations = orgs ?? [];

        this.orgIdByName.clear();
        for (const o of this.organizations) {
          const name = String(o?.full_name ?? '').trim();
          const id = Number(o?.id);
          if (name && Number.isFinite(id)) this.orgIdByName.set(name, id);
        }

        // feed existing template loop: *ngFor="let c of components"
        this.components = this.organizations
          .map(o => String(o?.full_name ?? '').trim())
          .filter(Boolean);

        if (!this.components.length) {
          this.orgsLoadError = 'Organization list is currently unavailable. Please try again later.';
          this.requestNewUserForm.get('component')?.disable({ emitEvent: false });
        } else {
          this.updateComponentEnabled();
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching organizations:', err);

        this.orgsLoading = false;
        this.orgsLoadError = 'Organization list is currently unavailable. Please try again later.';
        this.requestNewUserForm.get('component')?.disable({ emitEvent: false });

        this.cdr.detectChanges();
      },
    });
  }

  private updateComponentEnabled(): void {
    const ctrl = this.requestNewUserForm.get('component');
    if (!ctrl) return;

    // If org list is down, keep disabled regardless
    if (this.orgsLoadError) {
      ctrl.disable({ emitEvent: false });
      return;
    }

    if (this.isEditMode) ctrl.disable({ emitEvent: false });
    else ctrl.enable({ emitEvent: false });
  }

  private hydrateForEdit(u: User): void {
    this.isEditMode = true;
    this.editingUserId = u.id;

    this.requestNewUserForm.patchValue(
      {
        id: u.id,
        title: u.title ?? '',
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        email: u.email ?? '',
        employeeType: u.employeeType ?? '',
        component: u.component ?? '',
        role: u.role ?? '',
        office: u.office ?? '',
        isActive: !!u.isActive,
      },
      { emitEvent: false }
    );

    const et = String(u.employeeType || '').trim();
    const component = String(u.component || '').trim();
    const role = String(u.role || '').trim();
    const office = String(u.office || '').trim();

    if (et) {
      this.dropdowns.getRolesForEmployeeType(et).subscribe((roles: string[]) => {
        this.roleOptions = roles ?? [];
        if (role && this.roleOptions.includes(role)) {
          this.requestNewUserForm.get('role')!.setValue(role, { emitEvent: false });
        }
        this.cdr.detectChanges();
      });
    }

    if (component && role) {
      this.dropdowns.getOfficesForComponentRole(component, role).subscribe((offices: string[]) => {
        this.officeOptions = offices ?? [];
        if (office && this.officeOptions.includes(office)) {
          this.requestNewUserForm.get('office')!.setValue(office, { emitEvent: false });
        }
        this.cdr.detectChanges();
      });
    }
  }

  startEditUser(u: User): void {
    this.isEditMode = true;
    this.editingUserId = u.id;

    this.requestNewUserForm.patchValue(
      {
        id: u.id,
        title: u.title ?? '',
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        email: u.email ?? '',
        employeeType: u.employeeType ?? '',
        component: u.component ?? '',
        role: u.role ?? '',
        office: u.office ?? '',
        isActive: !!u.isActive,
      },
      { emitEvent: false }
    );

    const et = String(u.employeeType || '').trim();
    const component = String(u.component || '').trim();
    const role = String(u.role || '').trim();
    const office = String(u.office || '').trim();

    if (et) {
      this.dropdowns.getRolesForEmployeeType(et).subscribe((roles) => {
        this.roleOptions = roles ?? [];
        if (role && this.roleOptions.includes(role)) {
          this.requestNewUserForm.get('role')!.setValue(role, { emitEvent: false });
        }
      });
    }

    if (component && role) {
      this.dropdowns.getOfficesForComponentRole(component, role).subscribe((offices) => {
        this.officeOptions = offices ?? [];
        if (office && this.officeOptions.includes(office)) {
          this.requestNewUserForm.get('office')!.setValue(office, { emitEvent: false });
        }
      });
    }

    this.updateComponentEnabled();
  }

  showError(controlName: string): boolean {
    const ctrl = this.requestNewUserForm.get(controlName);
    return !!ctrl && ctrl.touched && ctrl.invalid;
  }

  get submitLabel(): string {
    if (this.isSubmitting) return 'Submitting…';

    if (this.isEditMode) return 'Save User';

    if (this.isEditMode) return 'Update Profile';

    return 'Send your request';
  }


  cancel(): void {
    this.router.navigateByUrl('/dashboard');
  }

  onSubmit(): void {
    this.submissionSuccess = false;
    this.submissionError = '';

    if (this.requestNewUserForm.invalid) {
      this.requestNewUserForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const formValue = this.requestNewUserForm.getRawValue();

    // component field holds organization full_name (phase 1)
    const component = String(formValue.component ?? '').trim();

    // derive org id from org list
    const organization_id = this.orgIdByName.get(component);

    if (!Number.isFinite(organization_id as any)) {
      this.isSubmitting = false;
      this.submissionError = 'Organization is required.';
      this.cdr.detectChanges();
      return;
    }

    const userPayload: User = {
      id: this.editingUserId ?? formValue.id,
      firstName: (formValue.firstName ?? '').trim(),
      lastName: (formValue.lastName ?? '').trim(),
      title: (formValue.title ?? '').trim(),
      email: (formValue.email ?? '').trim(),
      employeeType: formValue.employeeType,
      component,
      organization_id: organization_id as number,
      role: formValue.role,
      office: formValue.office,
      isActive: !!formValue.isActive,
    };

    const request$ = this.isEditMode
      ? this.userService.updateUser(userPayload.id as any, userPayload)
      : this.userService.requestNewUser(userPayload);

    request$.subscribe({
      next: (response) => {
        console.debug(this.isEditMode ? 'User updated successfully:' : 'User request submitted successfully:', response);

        if (this.isEditMode) {
          this.router.navigateByUrl('/admin/users');
          return;
        }

        this.isSubmitting = false;
        this.submissionSuccess = true;
        this.submissionError = '';

        this.isEditMode = false;
        this.editingUserId = null;

        this.requestNewUserForm.reset({ isActive: false });

        this.roleOptions = [];
        this.officeOptions = [];

        this.userService.getUsers().subscribe({
          next: (data: User[]) => {
            this.users = data ?? [];
            this.cdr.detectChanges();
          },
          error: (error) => console.error('Error fetching users:', error),
        });

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error submitting user request:', error);
        this.isSubmitting = false;
        this.submissionSuccess = false;

        this.submissionError = this.isEditMode
          ? 'Failed to update user. Please try again later.'
          : 'Failed to submit user request. Please try again later.';

        this.cdr.detectChanges();
      },
    });
  }

  cancelEdit(): void {
    this.isEditMode = false;
    this.editingUserId = null;
    this.requestNewUserForm.reset({
      id: '',
      title: '',
      firstName: '',
      lastName: '',
      email: '',
      employeeType: '',
      component: '',
      role: '',
      office: '',
      isActive: false,
    });
    this.roleOptions = [];
    this.officeOptions = [];
    this.updateComponentEnabled();
  }
}
