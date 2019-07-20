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
  fromAddress: string;
  toAddress: string;
  routeStatus: string;
  routeSpeed: number;

  readonly tabId = this._tabId;

  constructor(
    @Inject(TAB_ID) private readonly _tabId: number,
    private readonly _changeDetector: ChangeDetectorRef
  ) {
    // TODO get values from configuration/storage
    this.manualLat = 33;
    this.manualLon = 36;
    this.fromAddress = 'דיזינגוף 50, תל אביב';
    this.toAddress = 'עזה 17, ירושלים';
    this.routeStatus = 'No route loaded'; // TODO properly bind (via observable) to always instant update (tap change detection)
    this.routeSpeed = 10;
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

  getRoute() {
    const payload = {
      type: 'getRoute',
      from: this.fromAddress,
      to: this.toAddress
    }
    chrome.tabs.sendMessage(this.tabId, payload, message => {
      this.routeStatus = message;
    });
  }

  playRoute() {
    const payload = {
      type: 'playRoute',
      speed: this.routeSpeed
    }
    chrome.tabs.sendMessage(this.tabId, payload);
  }

  pauseRoute() {
    const payload = {
      type: 'pauseRoute',
      speed: this.routeSpeed
    }
    chrome.tabs.sendMessage(this.tabId, payload);
  }

  resetRoute() {
    const payload = {
      type: 'resetRoute',
      speed: this.routeSpeed
    }
    chrome.tabs.sendMessage(this.tabId, payload);
  }
}
