import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatDividerModule} from '@angular/material/divider';
import {MatGridListModule} from '@angular/material/grid-list';
import { FormsModule } from '@angular/forms';

export interface ServiceMusicPlan {
  date: Date;
  serviceType: string;
  orchestra1: string;
  orchestra2: string;
  orchestra3: string;
  orchestra4: string;
  orchestra5: string;
  choir1: string;
  choir2: string;
  choir3: string;
  choir4: string;
  congregationBS: string;
  congregationOH: string;
  congregationRP: string;
  congregationCM1: string;
  congregationCM2: string;
}

interface HTMLInputEvent extends Event {
  target: HTMLInputElement & EventTarget;
}

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [MatInputModule, MatButtonModule, MatDividerModule, MatGridListModule, MatFormFieldModule, FormsModule],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.css'
})
export class ScheduleComponent {
  dataSource: ServiceMusicPlan[] = [];

  fileContent: string | ArrayBuffer = '';

  public handleFileInput(e: Event): void {
    const fileEvent = e as HTMLInputEvent;
    let file: any = fileEvent.target.files![0];
    let fileReader: FileReader = new FileReader();
    let self = this;
    fileReader.onloadend = function(x) {
      self.fileContent = fileReader.result ?? "N/A";
      self.dataSource = JSON.parse(self.fileContent as string);
    }
    fileReader.readAsText(file);
  }

  public saveSchedule() : void {
    var a = document.createElement('a');
    a.setAttribute('href', 'data:text/plain;charset=utf-u,'+encodeURIComponent(JSON.stringify(this.dataSource)));
    a.setAttribute('download', 'nac_schedule_new.json');
    a.click()
  }
}
