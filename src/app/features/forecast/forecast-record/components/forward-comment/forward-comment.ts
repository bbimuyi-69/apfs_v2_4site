import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ForecastRecordService } from '../../services/forecast-record.service';

@Component({
  selector: 'app-forward-comment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forward-comment.html',
  styleUrls: ['./forward-comment.css'],
})
export class ForwardCommentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ForecastRecordService);

  recordId: number | null = null;

  // read from query params: ?from=Draft&to=Requirements&returnTo=record
  fromLane: string | null = null;
  toLane: string | null = null;
  returnTo: 'record' | 'dashboard' = 'record';

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
    // route param :id
    const idRaw = this.route.snapshot.paramMap.get('id');
    const id = idRaw ? Number(idRaw) : NaN;
    this.recordId = Number.isFinite(id) ? id : null;

    if (!this.recordId) {
      this.error = 'Missing or invalid record id.';
      return;
    }

    // query params
    const qp = this.route.snapshot.queryParamMap;
    this.fromLane = qp.get('from');
    this.toLane = qp.get('to');
    this.returnTo = (qp.get('returnTo') as any) === 'dashboard' ? 'dashboard' : 'record';

    if (!this.toLane) {
      this.error = 'Missing destination status (to).';
    }
  }

  get comment() {
    return this.form.controls.comment;
  }

  cancel(): void {
    if (!this.recordId) {
      this.router.navigate(['/dashboard-v2']);
      return;
    }

    // go back to wherever you came from
    if (this.returnTo === 'dashboard') {
      this.router.navigate(['/dashboard-v2']);
      return;
    }

    this.router.navigate(['/forecast', this.recordId], { queryParams: { mode: 'edit' } });
  }

  submitForward(): void {
    if (!this.recordId) return;

    console.group('[Forward Submit]');
    console.log('recordId:', this.recordId);
    console.log('fromLane:', this.fromLane);
    console.log('toLane:', this.toLane);
    console.log('comment:', this.comment.value);
    console.log('form.valid:', this.form.valid);
    console.groupEnd();

    this.submitted = true;
    this.error = null;

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const to = this.toLane;
    if (!to) {
      this.error = 'Missing destination status (to).';
      return;
    }

    const payload = {
      to,
      comment: this.comment.value.trim(),
    };

    this.submitting = true;

    this.service.transition(this.recordId, payload).subscribe({
      next: () => {
        /*const shouldGoDashboard =
          this.returnTo === 'dashboard' ||
          this.fromLane === 'Requirements' && this.toLane === 'Contracting';

        if (shouldGoDashboard) {
          this.router.navigate(['/dashboard-v2']);
        } else {
          this.router.navigate(['/forecast', this.recordId], { queryParams: { mode: 'edit' } });
        }*/

        this.router.navigate(['/dashboard-v2']);
      },
      error: (e: any) => {
        console.error('[ForwardComment] transition failed', e);
        this.error = e?.error?.message ?? 'Forward failed. Please try again.';
        this.submitting = false;
      },
      complete: () => {
        this.submitting = false;
      },
    });
  }
}
