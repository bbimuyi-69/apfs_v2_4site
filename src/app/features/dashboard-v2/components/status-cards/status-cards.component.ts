import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusCount } from '../../models/dashboard-v2.models';

@Component({
  selector: 'app-status-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-cards.component.html',
  styleUrl: './status-cards.component.css',
})
export class StatusCardsComponent {
  @Input() items: StatusCount[] = [];
  @Output() pick = new EventEmitter<string>();
}
