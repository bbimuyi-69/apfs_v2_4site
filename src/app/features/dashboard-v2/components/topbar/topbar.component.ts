import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-topbar-v2',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.css',
})
export class TopbarV2Component {
  @Input() env: 'DEV' | 'TEST' | 'PROD' = 'DEV';
  @Input() roleLabel: string = 'User';
  @Input() displayName: string = 'User';
}
