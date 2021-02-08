import { Injectable } from '@angular/core';
import {Observable, from} from "rxjs";
import {ConnectivityService} from "./connectivity.service";
import {SQLite} from "@ionic-native/sqlite/ngx";
import {SQLiteObject} from "@ionic-native/sqlite/ngx";

/**
 * Abstract Caching Service
 * Provides a local cache for objects returned from a backend
 *
 * Concrete services need to implement:
 *  getTtl - number of milliseconds cached elements should be retained
 *  getApi - call the backend API to retrieve the requested elements
 *  getTypePrefix - used to classify the elements in storage
 *  getId - extract the ID from the element
 */
@Injectable({
  providedIn: 'root'
})
export abstract class OfflineService<T> {
  // SQL Statements
  private sqlDeleteAll = `DELETE FROM ${this.getTypePrefix()}`;
  private sqlDeleteId = `DELETE FROM ${this.getTypePrefix()} where id = ?`
  private sqlDeleteExpired = `delete from ${this.getTypePrefix()} WHERE ttl <> -1 and ttl < ?`;
  private sqlGetElements = `select element from ${this.getTypePrefix()} where id in (?)`;
  private sqlAddElement = `insert into ${this.getTypePrefix()} (id, ttl, element) values (?, ?, ?)`;

  // Suppress DB invalidations to every x milliseconds
  private invalidationInterval:number = 5000;
  private lastInvalidation:number = 0;

  private isOnline:boolean = false;
  private database:SQLiteObject;

  /**
   * Initialize the service
   * @param sqlite
   * @param service
   * @protected
   */
  protected constructor(
    private sqlite:SQLite,
    private service:ConnectivityService
  ) {
    // Add network monitoring
    service.appIsOnline.subscribe(online => {
      this.isOnline = online;
    });

    // Connect to the database
    this.sqlite.create({
      name: 'stoffline.db',
      location: 'default'
    }).then((db:SQLiteObject) => {
      this.database = db;

      db.executeSql(
            `create table if not exists ${this.getTypePrefix()}(
                id char(64) PRIMARY KEY,
                ttl integer,
                element blob
             )`, [])
        .catch((e) => {
          console.log('Exception created table', e);
        }
      );
    });
  }

  /**
   * Return the cached element lifetime in milliseconds
   */
  abstract getTtl(): number;

  /**
   * Return the elements corresponding to the ids
   * @param ids
   */
  abstract getApi(ids: string[]):Observable<T[]>;

  /**
   * Get the prefix to be used for the element type - used when storing cached elements
   */
  abstract getTypePrefix(): string;

  /**
   * Return the ID for a given element
   * @param element
   */
  abstract getId(element:T): string;

  /**
   * Invalidate the cache
   */
  public invalidateAll(): Observable<void> {
    return from(this.database.executeSql(this.sqlDeleteAll, []));
  }

  public invalidate(id: string): Observable<void> {
    return from(this.database.executeSql(this.sqlDeleteId, [ id ]));
  }

  /**
   * Get the elements corresponding to the requested IDs
   * @param ids
   */
  getItem(ids: string[]):Observable<T[]> {
    return new Observable<T[]>(obs => {

      // Remove expired entries
      this.removeExpired().subscribe(() => {
        // The set of IDs retrieved from storage
        const haveIds:string[] = [];

        // Now get all of the matching elements from the db
        this.database.executeSql(this.sqlGetElements, [ids]).then(res => {

          // Iterate through the result set
          for(let i = 0, len = res.rows.length; i < length; i++) {
            const element:T = res.rows.item(i).element;
            obs.next(element);
            // Save the IDs we've retrieved so we can retrieve the remaining elements from the API
            haveIds.push(this.getId(element))
          }

          // calculate the set of IDs for the missing elements
          const needIds:string[] = ids.filter(x => !haveIds.includes(x));

          // If there are elements we need AND we're online...
          if(needIds.length > 0 && this.isOnline) {
            // Calc the time to live for the new records
            const now = new Date().getTime();
            const ttl = this.getTtl() === -1 ? -1 : this.getTtl() + now;

            // Get the missing elements from the API
            this.getApi(needIds).subscribe((rc) => {
              let promises:Promise<any>[] = [];

              rc.forEach((element: T) => {
                // Send the record to the observer
                obs.next(element);

                // Add the record to the database
                promises.push(this.database.executeSql(this.sqlAddElement, [this.getId(element), ttl, element]));
              });

              // Wait for all the database writes to complete
              Promise.all(promises).finally(() => {
                obs.complete();
              });

            });
          } else {
            // We had no records or we're offline, signal complete
            obs.complete();
          }
        }).catch(e => {
          console.log('Exception getting elements', e);
          obs.complete();
        });
      });
    });
  }

  /**
   * Remove expired elements from storage
   * @private
   */
  private removeExpired():Observable<void> {
    const now = new Date().getTime();
    if(this.lastInvalidation + this.invalidationInterval < now) {
      this.lastInvalidation = now;

      return from(
        this.database.executeSql(this.sqlDeleteExpired, [now]).catch(e => {
          console.log('Exception removing expired entities', e);
          return e;
        })
      );
    } else {
      return new Observable<void>((obs) => obs.complete());
    }
  }
}
