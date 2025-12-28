import { TestBed } from '@angular/core/testing';

import { ApfsDropdowns } from './apfs-dropdowns';

describe('ApfsDropdowns', () => {
  let service: ApfsDropdowns;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ApfsDropdowns);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
