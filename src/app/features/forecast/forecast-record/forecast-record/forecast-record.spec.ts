import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForecastRecord } from './forecast-record';

describe('ForecastRecord', () => {
  let component: ForecastRecord;
  let fixture: ComponentFixture<ForecastRecord>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForecastRecord]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ForecastRecord);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
