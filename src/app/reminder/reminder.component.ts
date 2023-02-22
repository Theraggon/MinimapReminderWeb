import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  BehaviorSubject,
  combineLatest,
  interval,
  Subscription,
  timer,
} from 'rxjs';
import { distinctUntilChanged, map, switchMap, take } from 'rxjs/operators';
import { SubSink } from 'subsink';
import { CachingService } from './caching.service';

export type reminderState = {
  interval: number;
  playTime: number;
  volume: number;
  soundType: OscillatorType;
  areNotificationsAllowed: boolean;
};
@Component({
  selector: 'app-reminder',
  templateUrl: './reminder.component.html',
  styleUrls: ['./reminder.component.scss'],
})
export class ReminderComponent implements OnInit, OnDestroy {
  private state: reminderState = {
    interval: 5000,
    playTime: 500,
    volume: 10,
    soundType: 'sine',
    areNotificationsAllowed: false,
  };

  private store = new BehaviorSubject<reminderState>(this.state);
  private state$ = this.store.asObservable();

  intervalValueInMilliseconds$ = this.state$.pipe(
    map((state) => state.interval),
    distinctUntilChanged()
  );
  intervalMinimum = 100;
  interval = this.intervalValueInMilliseconds$.pipe(
    switchMap((value) => {
      if (!value || value < 100) {
        value = 100;
      }
      return interval(value);
    })
  );

  playTimeValue$ = this.state$.pipe(
    map((state) => state.playTime),
    distinctUntilChanged()
  );
  playTimeMinimum = 50;

  volume$ = this.state$.pipe(
    map((state) => state.volume),
    distinctUntilChanged()
  );

  soundType$ = this.state$.pipe(
    map((state) => state.soundType),
    distinctUntilChanged()
  );

  areNotificationsAllowed$ = this.state$.pipe(
    map((state) => state.areNotificationsAllowed),
    distinctUntilChanged()
  );

  context: AudioContext;
  oscillator: OscillatorNode;
  gainNode: GainNode;

  subscribedInterval: Subscription;

  isVolumeWarningAlreadyDisplayed = false;

  subs = new SubSink();

  constructor(
    private snackBar: MatSnackBar,
    private cachingService: CachingService
  ) {}

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.stop();
  }

  ngOnInit(): void {
    const reminderCache = this.cachingService.getCache();
    if (reminderCache) {
      this.updateState(reminderCache);
    }

    this.createContext();
    this.createOscillator();
    this.oscillator.start();
    this.oscillator.connect(this.gainNode);

    this.state$.subscribe((state) => {
      this.cachingService.setCache(state);
    });
  }

  volumeSliderChanged(volumeValue: number) {
    console.log(`Volume: ${volumeValue}%`);
    this.updateState({ ...this.state, volume: volumeValue });

    if (volumeValue > 20 && !this.isVolumeWarningAlreadyDisplayed) {
      this.isVolumeWarningAlreadyDisplayed = true;
      this.snackBar.open(
        'The volume is usually loud enough even when low. Proceed with caution.',
        "I'll be careful",
        {}
      );
    }
  }

  intervalChanged(intervalValue: number) {
    console.log(`Interval: ${intervalValue}`);

    if (intervalValue < this.intervalMinimum) {
      intervalValue = this.intervalMinimum;
    }
    this.updateState({ ...this.state, interval: intervalValue });

    this.playTimeValue$.pipe(take(1)).subscribe((playTimeValue) => {
      if (intervalValue - this.playTimeMinimum <= playTimeValue) {
        if (intervalValue - this.playTimeMinimum < this.playTimeMinimum) {
          console.log(`Play time: ${this.playTimeMinimum}`);
          this.updateState({ ...this.state, playTime: this.playTimeMinimum });
        } else {
          console.log(`Play time: ${intervalValue - this.playTimeMinimum}`);
          this.updateState({
            ...this.state,
            playTime: intervalValue - this.playTimeMinimum,
          });
        }
      }
    });
  }

  playTimeChanged(playTimeValue: number) {
    console.log(`Play time: ${playTimeValue}`);

    if (playTimeValue < this.playTimeMinimum) {
      playTimeValue = this.playTimeMinimum;
    }
    this.updateState({ ...this.state, playTime: playTimeValue });

    this.intervalValueInMilliseconds$
      .pipe(take(1))
      .subscribe((intervalValue) => {
        if (playTimeValue + this.playTimeMinimum >= intervalValue) {
          console.log(`Interval: ${playTimeValue + this.playTimeMinimum}`);
          this.updateState({
            ...this.state,
            interval: playTimeValue + this.playTimeMinimum,
          });
        }
      });
  }

  soundTypeChanged(soundType: OscillatorType) {
    console.log(`Sound type: ${soundType}`);
    this.updateState({
      ...this.state,
      soundType,
    });
  }

  areNotificationsAllowedChanged(areNotificationsAllowed: boolean) {
    if(Notification.permission !== 'granted'){
      Notification.requestPermission();
    }
    this.updateState({
      ...this.state,
      areNotificationsAllowed,
    });
  }
  notify() {
    console.log('Notify!');
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notification");
    } else if (Notification.permission === "granted") {
      const notification = new Notification("Hi there!");
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          const notification = new Notification("Hi there!");
        }
      });
    }
  }

  start() {
    if (this.context && this.context.state !== 'running') {
      this.context.resume();
    }
    if (!this.subscribedInterval) {
      console.log('Started');
      this.subscribedInterval = this.interval.subscribe((event) => {
        this.oscillator.frequency.value = Math.random() * 5000 + 160; // Hz

        this.gainNode.connect(this.context.destination);
        combineLatest([this.playTimeValue$, this.intervalValueInMilliseconds$])
          .pipe(take(1))
          .subscribe(([playTime, intervalValue]) => {
            const disconnectTimer = this.createValidDisconnectTimer(
              playTime,
              intervalValue
            );
            this.areNotificationsAllowed$.pipe(take(1)).subscribe((areNotificationsAllowed) => {
              console.log(areNotificationsAllowed);
              if (areNotificationsAllowed) {
                this.notify();
              }
            });
            disconnectTimer.subscribe(() =>
              this.gainNode.disconnect(this.context.destination)
            );
          });
      });
    }
  }

  stop() {
    if (this.subscribedInterval) {
      console.log('Stopped');
      this.subscribedInterval.unsubscribe();
      this.subscribedInterval = null;
    }
  }

  formatVolumeLabel(value: number) {
    return `${value.toFixed(0)}%`;
  }

  private updateState(state: reminderState) {
    this.store.next((this.state = state));
  }

  private createContext() {
    this.context = new window.AudioContext();
    this.gainNode = this.context.createGain();
    this.subs.sink = this.volume$.subscribe((volume) => {
      this.gainNode.gain.value = volume / 100;
    });
  }

  private createOscillator() {
    this.oscillator = this.context.createOscillator();
    this.oscillator.type = 'sine'; // this is the default - also square, sawtooth, triangle
    this.subs.sink = this.soundType$.subscribe((type) => {
      this.oscillator.type = type;
    });
    this.oscillator.frequency.value = 240; // Hz
  }

  /*
   * Creates timer based on playTimeValue.
   * If playTime is too close to or over the intervalValue it defaults to playTimeMinimum
   */
  private createValidDisconnectTimer(
    playTimeValue: number,
    intervalValueInMilliseconds: number
  ) {
    let disconnectTimer;
    this.playTimeValue$.pipe(take(1)).subscribe((playTime) => {
      disconnectTimer = timer(playTime);
    });
    if (playTimeValue <= intervalValueInMilliseconds - 50) {
      disconnectTimer = timer(playTimeValue);
    } else {
      disconnectTimer = timer(this.playTimeMinimum);
    }
    return disconnectTimer;
  }
}
