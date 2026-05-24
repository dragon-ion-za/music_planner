import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import moment from 'moment';

@Component({
  selector: 'app-month-navigator',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './month-navigator.component.html',
  styleUrl: './month-navigator.component.css'
})
export class MonthNavigatorComponent {
  @Input() selectedMonth!: moment.Moment;
  @Output() monthChange = new EventEmitter<moment.Moment>();

  prev(): void {
    this.monthChange.emit(this.selectedMonth.clone().subtract(1, 'month'));
  }

  next(): void {
    this.monthChange.emit(this.selectedMonth.clone().add(1, 'month'));
  }
}
