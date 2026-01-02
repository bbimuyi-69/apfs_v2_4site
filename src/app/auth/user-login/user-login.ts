import { Component } from '@angular/core';
import { ReactiveFormsModule, Validators, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { UserLoginRequest } from '../auth.model';

@Component({
  selector: 'user-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './user-login.html',
  styleUrls: ['./user-login.css']
})
export class UserLogin {
  isSubmitting = false;
  errorMsg = '';
  private nextUrl: string;

  // Declare the property, initialize it in the constructor
  loginForm: FormGroup;

  constructor(
    private fb: NonNullableFormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });

    this.nextUrl = this.route.snapshot.queryParamMap.get('next') || '/dashboard-v2';
  }

  submit(): void {
    this.errorMsg = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    // ✅ safest: explicitly build credentials from the form controls
    const credentials: UserLoginRequest = {
      username: this.loginForm.get('username')!.value,
      password: this.loginForm.get('password')!.value
    };

    this.authService.login(credentials).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigateByUrl(this.nextUrl);
        console.log('logged in?', this.authService.isLoggedIn, this.authService.user);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMsg = err?.message ?? 'Login failed';
      }
    });
  }

  goResetPassword(): void {
    this.router.navigate(['/reset-password']);
  }

  goRequestAccount(): void {
    this.router.navigate(['/request-new-user']);
  }
}
