import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ForecastRecordService } from '../../services/forecast-record.service';
import { AuthService } from '../../../../../auth/auth.service';

@Component({
  selector: 'app-forward-comment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forward-comment.html',
  styleUrls: ['./forward-comment.css'],
})
export class ForwardCommentComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ForecastRecordService);
  private readonly auth = inject(AuthService);

  recordId: number | null = null;

  submitting = false;
  submitted = false;
  error: string | null = null;

  form = new FormGroup({
    comment: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2000)],
    }),
  });

  ngOnInit(): void {
    const idRaw = this.route.snapshot.paramMap.get('id');
    const id = idRaw ? Number(idRaw) : NaN;
    this.recordId = Number.isFinite(id) ? id : null;

    if (!this.recordId) {
      this.error = 'Missing or invalid record id.';
    }
  }

  get comment() {
    return this.form.controls.comment;
  }

  cancel(): void {
    if (this.recordId) {
      this.router.navigate(['/forecast', this.recordId], { queryParams: { mode: 'edit' } });
    } else {
      this.router.navigate(['/dashboard-v2']);
    }
  }

  submitForward(): void {
    if (!this.recordId) return;

    this.submitted = true;
    this.error = null;

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    // You don't *need* to send user info for /advance because server uses x-user-id,
    // but grabbing it is fine if you want for UI later.
    const user: any =
      (this.auth as any).user ??
      (this.auth as any).session?.user ??
      null;

    const payload = {
      comment: this.comment.value.trim(),
      // (optional) you can include these if you later choose to store them server-side
      userId: user?.id != null ? String(user.id) : null,
      userDisplay: user?.email ?? null,
    };

    this.submitting = true;

    this.service.advance(this.recordId, payload).subscribe({
      next: () => {
        this.router.navigate(['/forecast', this.recordId], {
          queryParams: { mode: 'edit' },
        });
      },
      error: (e: any) => {
        console.error('[ForwardComment] advance failed', e);
        this.error = e?.error?.message ?? 'Forward failed. Please try again.';
        this.submitting = false;
      },
      complete: () => {
        this.submitting = false;
      },
    });
  }
}
