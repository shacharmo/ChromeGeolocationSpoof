import { ChangeDetectorRef, Component, Inject, Input, Output, EventEmitter } from '@angular/core';
import { TAB_ID } from './tab-id.injector';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {
  manualLat: number;
  manualLon: number;
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
    // TODO option to set (and reset) global override
    this.manualLat = 33;
    this.manualLon = 36;
    this.fromAddress = 'דיזינגוף 50, תל אביב';
    this.toAddress = 'עזה 17, ירושלים';
    this.routeStatus = 'No route loaded';
    this.routeSpeed = 10;
  }

  getManualLocation() {
    const payload = {
      type: 'getLocation'
    }
    chrome.tabs.sendMessage(this.tabId, payload, (message) => {
      if (message.coords) {
        this.manualLat = message.coords.latitude;
        this.manualLon = message.coords.longitude;
      }
      this._changeDetector.detectChanges();
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
      this._changeDetector.detectChanges();
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
