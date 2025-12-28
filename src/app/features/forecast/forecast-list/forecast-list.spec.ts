import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForecastList } from './forecast-list';

describe('ForecastList', () => {
  let component: ForecastList;
  let fixture: ComponentFixture<ForecastList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForecastList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ForecastList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
