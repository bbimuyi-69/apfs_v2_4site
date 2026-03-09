import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';

import { ForecastRecord } from '../../../forecast/forecast-record/models/forecast-record.model';
import { ForecastRecordService } from '../../../forecast/forecast-record/services/forecast-record.service';
import { AuthService } from '../../../../auth/auth.service';

@Component({
  selector: 'app-record-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './record-drawer.component.html',
  styleUrls: ['./record-drawer.component.css'],
})
export class RecordDrawerComponent {
  private readonly router = inject(Router);
  private readonly service = inject(ForecastRecordService);
  private readonly auth = inject(AuthService);

  @Input({ required: true }) record!: ForecastRecord;

  @Output() close = new EventEmitter<void>();
  @Output() recordUpdated = new EventEmitter<ForecastRecord>();

  closing = false;
  private busy = false;

  // ---------- Display helpers ----------
  get assignedToName(): string {
    const r: any = this.record as any;
    return (
      r?.assignedToName ??
      r?.assignedToDisplayName ??
      r?.assignedToUserName ??
      r?.assignedToEmail ??
      '—'
    );
  }

  get isAssigned(): boolean {
    const v: any = (this.record as any)?.assignedToUserId;
    return v != null && String(v).trim() !== '';
  }

  private get meId(): string | null {
    const u: any = this.auth.user;
    const id = u?.id;
    return id != null ? String(id) : null;
  }

  get isAssignedToMe(): boolean {
    const me = this.meId;
    const assigned = (this.record as any)?.assignedToUserId;
    if (!me || !assigned) return false;
    return String(assigned) === me;
  }

  isBusy(): boolean {
    return this.busy;
  }

  // ---------- Lane / role logic (claim rules) ----------
  private normalizeRole(raw: unknown): 'requirements' | 'contracting' | 'coordinator' | 'admin' | 'other' {
    const r = String(raw ?? '').trim().toLowerCase();
    if (r === 'requirements') return 'requirements';
    if (r === 'contracting' || r === 'contracting office') return 'contracting';
    if (r === 'apfs coordinator' || r.includes('coordinator')) return 'coordinator';
    if (r === 'admin' || r.includes('admin')) return 'admin';
    return 'other';
  }

  private normalizeLane(raw: unknown): 'draft' | 'requirements' | 'contracting' | 'coordinator' | 'published' | 'other' {
    const s = String(raw ?? '').trim().toLowerCase();
    if (s.includes('draft')) return 'draft';
    if (s.includes('require')) return 'requirements';
    if (s.includes('contract')) return 'contracting';
    if (s.includes('coordinator')) return 'coordinator';
    if (s.includes('publish')) return 'published';
    return 'other';
  }

  /**
   * Lane is read from workflowStatus (preferred) or legacy status.
   */
  private get recordLane(): 'draft' | 'requirements' | 'contracting' | 'coordinator' | 'published' | 'other' {
    const r: any = this.record as any;
    return this.normalizeLane(r?.workflowStatus ?? r?.status);
  }

  /**
   * Defines whether the current user is allowed to work/claim in this record's lane.
   * Draft policy (common): Draft belongs to Requirements.
   * Change if you want Draft claimable by other roles.
   */
  private isInMyWorkLane(): boolean {
    const u: any = this.auth.user;
    if (!u) return false;

    const role = this.normalizeRole(u.role);
    const lane = this.recordLane;

    // Block claiming published records
    if (lane === 'published') return false;

    // Admin override (optional): allow admin to claim anything not published
    if (role === 'admin') return true;

    // Draft policy: Requirements owns Draft
    if (lane === 'draft') return role === 'requirements';

    if (lane === 'requirements') return role === 'requirements';
    if (lane === 'contracting') return role === 'contracting';
    if (lane === 'coordinator') return role === 'coordinator';

    return false;
  }

  /**
   * Claim button should be enabled if:
   * - not busy
   * - logged in
   * - record is in my lane
   * - record is not already assigned to me
   *
   * ✅ Allows "takeover claim" when assigned to someone else (in-lane).
   */
  canClaim(): boolean {

    console.log('[Claim Debug]', {
      role: this.auth.user?.role,
      lane: (this.record as any)?.workflowStatus ?? (this.record as any)?.status,
      assignedToUserId: (this.record as any)?.assignedToUserId,
      isAssignedToMe: this.isAssignedToMe,
    });
    if (this.busy) return false;
    const me = this.meId;
    if (!me) return false;
    if (!this.isInMyWorkLane()) return false;

    // If already mine, no need to claim
    return !this.isAssignedToMe;
  }

  onClaim(): void {
    if (this.busy) return;

    const id = (this.record as any)?.id;
    if (typeof id !== 'number') {
      console.warn('[RecordDrawer] Cannot claim record — invalid or missing id', this.record);
      return;
    }

    const user: any = this.auth.user;
    if (!user?.id) {
      console.warn('[RecordDrawer] Cannot claim record — no logged-in user/session');
      return;
    }

    if (!this.isInMyWorkLane()) {
      console.warn('[RecordDrawer] Cannot claim — record is not in your work lane');
      return;
    }

    // If assigned to someone else, confirm takeover
    if (this.isAssigned && !this.isAssignedToMe) {
      const who = this.assignedToName;
      const ok = confirm(`This record is currently assigned to ${who}.\n\nClaim it anyway?`);
      if (!ok) return;
    }

    this.busy = true;

    const payload: any = {
      userId: String(user.id),
      userName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Unknown User',
      force: true, // backend can use this to allow takeover
    };

    this.service
      .claim(id, payload)
      .subscribe({
        next: (updated) => {
          this.record = updated;
          this.recordUpdated.emit(updated);
        },
        error: (err) => {
          console.error('[RecordDrawer] Claim failed', err);
        },
      })
      .add(() => {
        this.busy = false;
      });
  }

  openRecord(): void {
    const id = (this.record as any)?.id;
    if (!id) return;

    this.requestClose();

    this.router.navigate(['/forecast', id], {
      queryParams: { mode: 'edit' },
    });
  }

  requestClose(): void {
    if (this.closing) return;
    this.closing = true;
    setTimeout(() => this.close.emit(), 180);
  }


  copiedId: string | number | null = null;
  private copiedTimer: any;

  copyForecastLink(r: any): void {
    const id = r?.id;
    if (!id) return;

    const url = `${window.location.origin}/forecast/${id}`; // ✅ share link default

    navigator.clipboard.writeText(url)
      .then(() => this.showCopied(id))
      .catch(() => {
        // fallback (optional)
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.showCopied(id);
      });
  }

  private showCopied(id: string | number): void {
    this.copiedId = id;

    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => {
      this.copiedId = null;
    }, 1500);
  }
}
