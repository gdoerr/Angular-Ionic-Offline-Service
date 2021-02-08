import {ListingDTO} from "./listing.dto";
import {OfflineService} from "./offline.service";
import {Observable} from "rxjs";
import {Injectable} from "@angular/core";

/**
 * Concrete Offline Listing Service
 */
@Injectable({
  providedIn: 'root'
})
class OfflineListingService extends OfflineService<ListingDTO> {

  /**
   * Get the requested listings from the API
   * @param ids
   */
  getApi(ids: string[]): Observable<ListingDTO[]> {
    return new Observable<ListingDTO[]>(obs => {
      obs.next([]);
      obs.complete();
    });
  }

  /**
   * Get the ID for a given element
   * @param element
   */
  getId(element: ListingDTO): string {
    return element.id;
  }

  /**
   * Get the Time To Live for this element type
   */
  getTtl(): number {
    return 180;
  }

  /**
   * Get the string type of the element
   */
  getTypePrefix(): string {
    return 'stListing';
  }

}
