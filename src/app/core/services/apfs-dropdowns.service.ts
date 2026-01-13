import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  COMPONENTS,
  EMPLOYEE_TYPES,
  ROLES_BY_EMPLOYEE_TYPE,
  OFFICES_BY_COMPONENT_AND_ROLE,
  EmployeeType
} from '../../config/apfs-dropdowns.config';

@Injectable({ providedIn: 'root' })
export class ApfsDropdownsService {

  getEmployeeTypes(): Observable<EmployeeType[]> {
    return of(EMPLOYEE_TYPES);
  }

  getComponents(): Observable<string[]> {
    return of(COMPONENTS);
  }

  getRolesForEmployeeType(employeeType: string): Observable<string[]> {
    const key = employeeType as EmployeeType;
    return of(ROLES_BY_EMPLOYEE_TYPE[key] ?? []);
  }

  // ✅ ONLY way to get offices
  getOfficesForComponentRole(component: string, role: string): Observable<string[]> {
    return of(OFFICES_BY_COMPONENT_AND_ROLE?.[component]?.[role] ?? []);
  }
}
