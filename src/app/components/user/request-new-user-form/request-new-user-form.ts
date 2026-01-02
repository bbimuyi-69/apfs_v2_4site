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
  officeOptions: string[] = [];
  roleOptions: string[] = [];

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private dropdowns: ApfsDropdownsService
  ) { }

  ngOnInit(): void {
    // 1) Build the form (ONLY controls go here)
    this.requestNewUserForm = this.fb.group({
      id: [''], // optional

      title: ['', Validators.required],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],

      email: ['', [Validators.required, Validators.email]],

      employeeType: ['', Validators.required],
      component: ['', Validators.required],
      office: ['', Validators.required],
      role: ['', Validators.required],

      isActive: [false]
    });

    // 2) Load base dropdown lists
    this.dropdowns.getEmployeeTypes().subscribe(list => (this.employeeTypes = list));
    this.dropdowns.getComponents().subscribe(list => (this.components = list));

    // 3) Wire dependent dropdowns

    // employeeType -> roleOptions
    this.requestNewUserForm.get('employeeType')!.valueChanges.subscribe((val: string) => {
      this.dropdowns.getRolesForEmployeeType(val).subscribe(roles => {
        this.roleOptions = roles;

        const currentRole = this.requestNewUserForm.get('role')!.value;
        if (!this.roleOptions.includes(currentRole)) {
          this.requestNewUserForm.get('role')!.setValue('');
        }
      });
    });

    // component -> officeOptions
    this.requestNewUserForm.get('component')!.valueChanges.subscribe((val: string) => {
      this.dropdowns.getOfficesForComponent(val).subscribe(offices => {
        this.officeOptions = offices;

        const currentOffice = this.requestNewUserForm.get('office')!.value;
        if (!this.officeOptions.includes(currentOffice)) {
          this.requestNewUserForm.get('office')!.setValue('');
        }
      });
    });

    // 4) Optional: existing call
    this.userService.getUsers().subscribe({
      next: (data: User[]) => {
        this.users = data;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error fetching users:', error);
      }
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
      office: formValue.office,
      role: formValue.role,
      isActive: formValue.isActive
    };

    this.userService.requestNewUser(newUser).subscribe({
      next: (response) => {
        console.debug('User request submitted successfully:', response);
        this.isSubmitting = false;
        this.submissionSuccess = true;
        this.submissionError = '';
        this.requestNewUserForm.reset({ isActive: false });
        this.officeOptions = [];
        this.roleOptions = [];
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
