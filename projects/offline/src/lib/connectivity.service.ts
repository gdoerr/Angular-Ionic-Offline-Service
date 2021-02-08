import { Injectable } from '@angular/core';
import { Observable, fromEvent, merge, of} from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Service to monitor the online/offline network connection state
 * from browser APIs. This is a place-holder and not a valid implementation
 * for production.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {

  public appIsOnline: Observable<boolean>;

  constructor() {
    if (!window || !navigator || !('onLine' in navigator)) {
      console.log('Could not access browser online APIs');
      return;
    }

    // Create the observable with two events
    this.appIsOnline = merge(
      of(null),
      fromEvent(window, 'online'),
      fromEvent(window, 'offline')
    ).pipe(map(() => navigator.onLine))
  }

}
