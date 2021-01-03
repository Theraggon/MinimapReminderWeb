import { Injectable } from '@angular/core';
import { reminderState } from './reminder.component';

@Injectable({
  providedIn: 'root',
})
export class CachingService {
  localStorage = window.localStorage;
  localStorageKey = 'reminderCache';

  constructor() {}

  getCache(): reminderState {
    if (!localStorage) {
      return null;
    }
    const cache = this.localStorage.getItem(this.localStorageKey);
    if (!cache) {
      return null;
    }
    return JSON.parse(cache);
  }

  setCache(state: reminderState) {
    const cacheJSON = JSON.stringify(state);
    if (localStorage) {
      this.localStorage.setItem(this.localStorageKey, cacheJSON);
    }
  }
}
