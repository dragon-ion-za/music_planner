import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragEnd, CdkDragMove } from '@angular/cdk/drag-drop';
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
  /** Emitted when this slot is released; point is the pointer position in viewport coordinates. */
  @Output() slotDropped = new EventEmitter<{ slot: ServiceSlotViewModel; point: { x: number; y: number } }>();

  /** True while another slot is being dragged over this one (valid swap target). */
  @Input() dropTarget = false;
  /** Emitted continuously while this slot is dragged; used to highlight the slot under the pointer. */
  @Output() slotDragMoved = new EventEmitter<{ slot: ServiceSlotViewModel; point: { x: number; y: number } }>();

  onDragMoved(event: CdkDragMove): void {
    this.slotDragMoved.emit({ slot: this.slot, point: event.pointerPosition });
  }

  onDragEnded(event: CdkDragEnd): void {
    this.slotDropped.emit({ slot: this.slot, point: event.dropPoint });
  }

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
