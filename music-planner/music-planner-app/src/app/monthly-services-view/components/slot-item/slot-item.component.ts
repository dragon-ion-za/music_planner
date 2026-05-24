import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ServiceSlotViewModel, SlotConflictStatus } from '../../models/service.model';

@Component({
  selector: 'app-slot-item',
  standalone: true,
  imports: [CommonModule, CdkDrag, MatTooltipModule],
  templateUrl: './slot-item.component.html',
  styleUrl: './slot-item.component.css'
})
export class SlotItemComponent {
  @Input() slot!: ServiceSlotViewModel;
  @Input() conflict: SlotConflictStatus | null = null;
  @Input() disabled = false;

  get conflictClass(): string {
    if (!this.conflict || !this.conflict.severity) return '';
    return `conflict-${this.conflict.severity}`;
  }

  get tooltipText(): string {
    if (!this.conflict || this.conflict.conflictingDates.length === 0) return '';
    return this.conflict.conflictingDates
      .map(d => `${d.date} (${d.serviceType})`)
      .join('\n');
  }
}
