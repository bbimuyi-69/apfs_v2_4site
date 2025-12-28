import { Component , OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../../../models/user.model'; 
import { UserService } from '../../../services/user';


@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-list.html',
  styleUrl: './user-list.css',
})
export class UserList implements OnInit {

  users: User[] = [];

  constructor( private userService:UserService,private cdr: ChangeDetectorRef ) {
    //
  } 

  ngOnInit() {
    this.userService.getUsers().subscribe({
      next: (data: User[]) => {
        this.users = data;
        console.debug('Data Loaded:', this.users) ;
        this.cdr.detectChanges();
    },error: (error) => {
        console.error('Error fetching users:', error) ;
        }
    });   
  }


}
