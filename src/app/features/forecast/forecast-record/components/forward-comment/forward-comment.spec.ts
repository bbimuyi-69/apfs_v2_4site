import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForwardComment } from './forward-comment';

describe('ForwardComment', () => {
  let component: ForwardComment;
  let fixture: ComponentFixture<ForwardComment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForwardComment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ForwardComment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
