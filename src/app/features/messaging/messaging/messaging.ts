import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';   // 👈 ADD THIS
import { CommonModule } from '@angular/common'; // 👈 ALSO THIS

import { MessagingService, UserNotification } from '../services/messaging.service';

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

  // TODO replace with auth user later
  userId = 1768502629880;

  constructor(
    private messagingService: MessagingService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();

    this.messagingService.list(this.userId).subscribe({
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