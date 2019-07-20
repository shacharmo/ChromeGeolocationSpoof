import { ChangeDetectorRef, Component, Inject, Input, Output, EventEmitter } from '@angular/core';
import { TAB_ID } from './tab-id.injector';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
// tslint:disable:variable-name
export class AppComponent {
  @Input() manualLat: number;
  @Output() manualLatChange = new EventEmitter<number>();
  @Input() manualLon: number;
  @Output() manualLonChange = new EventEmitter<number>();

  readonly tabId = this._tabId;

  constructor(
    @Inject(TAB_ID) private readonly _tabId: number,
    private readonly _changeDetector: ChangeDetectorRef
  ) {
    this.manualLat = 33;
    this.manualLon = 36;
  }

  getManualLocation() {
    const payload = {
      type: 'getLocation'
    }
    chrome.tabs.sendMessage(this.tabId, payload, (message) => {
      this.manualLat = message.coords.latitude;
      this.manualLatChange.emit(this.manualLat);
      this.manualLon = message.coords.longitude;
      this.manualLonChange.emit(this.manualLon);
    });
  }

  setManualLocation() {
    const payload = {
      type: 'setLocation',
      lat: this.manualLat,
      lon: this.manualLon
    }
    chrome.tabs.sendMessage(this.tabId, payload);
  }
}
