import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';   // 
import { CommonModule } from '@angular/common'; // 

import { MessagingService, UserNotification } from '../services/messaging.service';
import { AuthService } from '../../../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-messaging',
  templateUrl: './messaging.html',
  styleUrls: ['./messaging.css'],
  imports: [
    CommonModule,   // 
    FormsModule     // 
  ]
})
export class MessagingPage implements OnInit {
  pageTitle = 'Message List';

  loading = false;
  error: string | null = null;

  allResults: UserNotification[] = [];
  results: UserNotification[] = [];

  quickSearch = '';

  filters = {
    subject: ''
  };

  showFilters = false;

  selectedIds = new Set<number>();

  selectedMessage: UserNotification | null = null;

  userId: number | null = null;

  constructor(
    private messagingService: MessagingService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.initUserAndLoad();
  }

  private initUserAndLoad(): void {
    const me = this.authService.user;

    if (!me?.id) {
      this.error = 'User not available';
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    this.userId = Number(me.id);
    this.load();
  }

  load(): void {
    if (this.userId == null) {
      this.error = 'No user id available.';
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    const userId = this.userId; // ✅ now TS knows this is number

    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();

    this.messagingService.list(userId).subscribe({
      next: (rows) => {
        this.allResults = rows ?? [];
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.message ?? 'Failed to load messages';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    let data = [...this.allResults];

    const q = this.quickSearch.toLowerCase();

    if (q) {
      data = data.filter(x =>
        x.subject.toLowerCase().includes(q) ||
        x.body.toLowerCase().includes(q)
      );
    }

    if (this.filters.subject) {
      const s = this.filters.subject.toLowerCase();
      data = data.filter(x => x.subject.toLowerCase().includes(s));
    }

    this.results = data.sort((a, b) =>
      new Date(b.time).getTime() - new Date(a.time).getTime()
    );
  }

  toggleSelect(id: number, event: Event): void {
    event.stopPropagation();

    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  toggleAll(): void {
    if (this.selectedIds.size === this.results.length) {
      this.selectedIds.clear();
    } else {
      this.results.forEach(x => this.selectedIds.add(x.id));
    }
  }

  openMessage(row: UserNotification): void {
    this.selectedMessage = row;

    if (row.read === 0) {
      row.read = 1;

      this.messagingService.markRead(row.id, 1).subscribe({
        error: () => {
          row.read = 0;
        }
      });
    }
  }

  closeMessage(): void {
    this.selectedMessage = null;
  }

  markSelected(read: 0 | 1): void {
    const ids = Array.from(this.selectedIds);
    if (!ids.length) return;

    this.messagingService.markMany(ids, read).subscribe(() => {
      this.allResults.forEach(x => {
        if (this.selectedIds.has(x.id)) {
          x.read = read;
        }
      });
      this.selectedIds.clear();
      this.applyFilters();
    });
  }

  deleteSelected(): void {
    const ids = Array.from(this.selectedIds);
    if (!ids.length) return;

    this.messagingService.deleteMany(ids).subscribe(() => {
      this.allResults = this.allResults.filter(x => !this.selectedIds.has(x.id));
      this.selectedIds.clear();
      this.applyFilters();
    });
  }
}