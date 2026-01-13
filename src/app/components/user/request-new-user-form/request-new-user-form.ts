import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models/user.model';
import { ApfsDropdownsService } from '../../../core/services/apfs-dropdowns.service';

@Component({
  selector: 'app-request-new-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './request-new-user-form.html',
  styleUrls: ['./request-new-user-form.css']
})
export class RequestNewUserForm implements OnInit {
  requestNewUserForm!: FormGroup;

  users: User[] = [];
  submissionSuccess = false;
  submissionError = '';
  isSubmitting = false;

  employeeTypes: string[] = [];
  components: string[] = [];
  roleOptions: string[] = [];
  officeOptions: string[] = [];

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private dropdowns: ApfsDropdownsService
  ) { }

  ngOnInit(): void {
    this.requestNewUserForm = this.fb.group({
      id: [''],

      title: ['', Validators.required],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],

      employeeType: ['', Validators.required],
      component: ['', Validators.required],
      role: ['', Validators.required],
      office: ['', Validators.required],

      isActive: [false]
    });

    // Base lists
    this.dropdowns.getEmployeeTypes().subscribe((list: string[]) => (this.employeeTypes = list));
    this.dropdowns.getComponents().subscribe((list: string[]) => (this.components = list));

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

      const et = String(employeeType || '').trim();
      if (!et) return;

      this.dropdowns.getRolesForEmployeeType(et).subscribe((roles: string[]) => {
        this.roleOptions = roles ?? [];

        const currentRole = this.requestNewUserForm.get('role')!.value;
        if (!this.roleOptions.includes(currentRole)) {
          this.requestNewUserForm.get('role')!.setValue('');
        }
      });
    });

    // 2) component changes -> clear office then reload offices if role already chosen
    this.requestNewUserForm.get('component')!.valueChanges.subscribe((_component: string) => {
      clearOffice();
      reloadOfficesIfReady();
    });

    // 3) role changes -> clear office then reload offices if component already chosen
    this.requestNewUserForm.get('role')!.valueChanges.subscribe((_role: string) => {
      clearOffice();
      reloadOfficesIfReady();
    });

    // Existing call (optional)
    this.userService.getUsers().subscribe({
      next: (data: User[]) => {
        this.users = data;
        this.cdr.detectChanges();
      },
      error: (error) => console.error('Error fetching users:', error)
    });
  }

  showError(controlName: string): boolean {
    const ctrl = this.requestNewUserForm.get(controlName);
    return !!ctrl && ctrl.touched && ctrl.invalid;
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

    const newUser: User = {
      id: formValue.id,
      firstName: (formValue.firstName ?? '').trim(),
      lastName: (formValue.lastName ?? '').trim(),
      title: (formValue.title ?? '').trim(),
      email: (formValue.email ?? '').trim(),
      employeeType: formValue.employeeType,
      component: formValue.component,
      role: formValue.role,
      office: formValue.office,
      isActive: formValue.isActive
    };

    this.userService.requestNewUser(newUser).subscribe({
      next: (response) => {
        console.debug('User request submitted successfully:', response);
        this.isSubmitting = false;
        this.submissionSuccess = true;
        this.submissionError = '';
        this.requestNewUserForm.reset({ isActive: false });

        // reset dependent dropdown state
        this.roleOptions = [];
        this.officeOptions = [];

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error submitting user request:', error);
        this.isSubmitting = false;
        this.submissionSuccess = false;
        this.submissionError = 'Failed to submit user request. Please try again later.';
        this.cdr.detectChanges();
      }
    });
  }
}
