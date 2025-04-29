import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatDividerModule} from '@angular/material/divider';
import {MatGridListModule} from '@angular/material/grid-list';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import {MatDatepickerModule} from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import moment from 'moment';

export interface ServiceMusicPlan {
  date: Date;
  serviceType: string;
  songs: Song[];
}

export class Song {
  type: string = '';
  number: string = '';
  conflicts: ConflictDetail[] = [];
  quarterConflicts: ConflictDetail[] = [];
  yearConflicts: ConflictDetail[] = [];
}

export interface ConflictDetail {
  date: Date;
  type: string;
}

interface HTMLInputEvent extends Event {
  target: HTMLInputElement & EventTarget;
}

export const MY_FORMATS = {
  parse: {
    dateInput: 'LL',
  },
  display: {
    dateInput: 'YYYY-MM-DD',
    monthYearLabel: 'YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'YYYY',
  },
};

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [MatInputModule, MatButtonModule, MatDividerModule, MatGridListModule, MatFormFieldModule, FormsModule, MatTooltipModule, MatDatepickerModule],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.css',
  providers: [
    {provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE]},
    {provide: MAT_DATE_FORMATS, useValue: MY_FORMATS},
  ]
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
      self.dataSource = JSON.parse(self.fileContent as string, self.reviveDate);

      self.dataSource = self.dataSource.sort((x, y) =>  x.date > y.date ? 1 : x.date == y.date ? 0 : -1);
      let startDate = self.dataSource[0].date;
      let endDate = self.dataSource[self.dataSource.length - 1].date;

      self.calculateConflicts(startDate, endDate);
    }
    fileReader.readAsText(file);
  }

  public checkForConflicts(e: Event, serviceDate: Date) {
    let endDate = new Date(serviceDate);
    endDate.setMonth(endDate.getMonth() + 6);
    let startDate = new Date(serviceDate);
    startDate.setMonth(startDate.getMonth() - 6);

    this.calculateConflicts(startDate, endDate);
  }

  private calculateConflicts(startDate: Date, endDate: Date) {
    let filteredSchedule = this.dataSource.filter(x => x.date >= startDate && x.date <= endDate);
    let mappedSongs: any[] = filteredSchedule.map(x => x.songs.map(y => <any>{ date: x.date, number: y.number, type: y.type })).flatMap(x => x);
    filteredSchedule.forEach(x => {
      x.songs.forEach(y => {
        y.conflicts = [];
        y.quarterConflicts = [];
        y.yearConflicts = [];
        if (y.number !== '' && y.number !== 'N/A') {
          mappedSongs.filter(z => z.number == y.number && z.date != x.date).forEach(z => {
            //y.conflicts.push({date: z.date, type: z.type});

            // attempted new logic
            var dateDiff = x.date.valueOf() - z.date.valueOf();
            var diffDays = Math.ceil(dateDiff / (1000 * 3600 * 24));
            console.log(diffDays);
            if (diffDays > 90 || diffDays < -90) {
              y.yearConflicts.push({date: z.date, type: z.type});
            }
            else if (diffDays > 56 || diffDays < -56) {
              y.quarterConflicts.push({date: z.date, type: z.type});
            }
            else if (diffDays <= 56 || diffDays >= -56) {
              y.conflicts.push({date: z.date, type: z.type});
            }
          });
        }
      });
    });
  }

  public saveSchedule() : void {
    var a = document.createElement('a');
    a.setAttribute('href', 'data:text/plain;charset=utf-u,'+encodeURIComponent(JSON.stringify(this.dataSource)));
    a.setAttribute('download', 'nac_schedule_new.json');
    a.click()
  }

  public reviveDate(key: string, value: any) {
    // Matches strings like "2022-08-25T09:39:19.288Z"
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
  
    return typeof value === 'string' && isoDateRegex.test(value) ? new Date(value) : value
  }

  public buildConflictsTooltip(conflicts: ConflictDetail[]) : string {
    return conflicts.map(x => `${moment(x.date).format('YYYY-MM-DD')} - ${x.type}`).join('\n');
  }

  public addDate() : void {
    this.dataSource.push({ date: new Date(), serviceType: '', songs: [
      { type: 'orchestra1', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'orchestra2', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'orchestra3', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'orchestra4', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'orchestra5', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'choir1', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'choir2', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'choir3', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'choir4', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'congregationBS', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'congregationOH', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'congregationRP', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'congregationCM1', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      { type: 'congregationCM2', number: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] }
    ] });
  }
}
