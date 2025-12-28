import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-nav-rail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './nav-rail.component.html',
  styleUrl: './nav-rail.component.css',
})
export class NavRailComponent {}
