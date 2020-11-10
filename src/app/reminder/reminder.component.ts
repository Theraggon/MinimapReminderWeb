import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, interval, Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SubSink } from 'subsink';

@Component({
  selector: 'app-reminder',
  templateUrl: './reminder.component.html',
  styleUrls: ['./reminder.component.scss'],
})
export class ReminderComponent implements OnInit, OnDestroy {
  intervalValueInMilliseconds$ = new BehaviorSubject(5000);
  intervalMinimum = 100;
  interval = this.intervalValueInMilliseconds$.pipe(
    switchMap((value) => {
      if (!value || value < 100) {
        value = 100;
      }
      return interval(value);
    })
  );

  playTimeValue$ = new BehaviorSubject(500);
  playTimeMinimum = 50;

  volume$ = new BehaviorSubject(10);

  soundType$ = new BehaviorSubject<OscillatorType>('sine');

  context: AudioContext;
  oscillator: OscillatorNode;
  gainNode: GainNode;

  subscribedInterval: Subscription;

  isVolumeWarningAlreadyDisplayed = false;

  subs = new SubSink();

  constructor(private snackBar: MatSnackBar) {}

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.stop();
  }

  ngOnInit(): void {
    this.createContext();
    this.createOscillator();
    this.oscillator.start();
    this.oscillator.connect(this.gainNode);
  }

  private createOscillator() {
    this.oscillator = this.context.createOscillator();
    this.oscillator.type = 'sine'; // this is the default - also square, sawtooth, triangle
    this.subs.sink = this.soundType$.subscribe((type) => {
      this.oscillator.type = type;
    });
    this.oscillator.frequency.value = 240; // Hz
  }

  private createContext() {
    this.context = new window.AudioContext();
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = this.volume$.value / 100;
    this.subs.sink = this.volume$.subscribe((volume) => {
      this.gainNode.gain.value = volume / 100;
    });
  }

  volumeSliderChanged(event: { value: number }) {
    const volumeValue = event.value;
    console.log(`Volume: ${volumeValue}%`);
    this.volume$.next(volumeValue);

    if (volumeValue > 20 && !this.isVolumeWarningAlreadyDisplayed) {
      this.isVolumeWarningAlreadyDisplayed = true;
      this.snackBar.open(
        'The volume is usually loud enough even when low. Proceed with caution.',
        "I'll be careful",
        {}
      );
    }
  }

  intervalChanged(event: { target: HTMLInputElement }) {
    let intervalValue = event.target.valueAsNumber;
    console.log(`Interval: ${intervalValue}`);

    if (intervalValue < this.intervalMinimum) {
      intervalValue = this.intervalMinimum;
    }

    this.intervalValueInMilliseconds$.next(intervalValue);

    if (intervalValue - this.playTimeMinimum <= this.playTimeValue$.value) {
      if (intervalValue - this.playTimeMinimum < this.playTimeMinimum) {
        console.log(`Play time: ${this.playTimeMinimum}`);
        this.playTimeValue$.next(this.playTimeMinimum);
      } else {
        console.log(`Play time: ${intervalValue - this.playTimeMinimum}`);
        this.playTimeValue$.next(intervalValue - this.playTimeMinimum);
      }
    }
  }

  playTimeChanged(event: { target: HTMLInputElement }) {
    let playTimeValue = event.target.valueAsNumber;
    console.log(`Play time: ${playTimeValue}`);

    if (playTimeValue < this.playTimeMinimum) {
      playTimeValue = this.playTimeMinimum;
    }
    this.playTimeValue$.next(playTimeValue);

    if (
      playTimeValue + this.playTimeMinimum >=
      this.intervalValueInMilliseconds$.value
    ) {
      console.log(`Interval: ${playTimeValue + this.playTimeMinimum}`);
      this.intervalValueInMilliseconds$.next(
        playTimeValue + this.playTimeMinimum
      );
    }
  }

  soundTypeChanged(event) {
    console.log(`Sound type: ${event.value}`);
    this.soundType$.next(event.value);
  }

  start() {
    if (!this.subscribedInterval) {
      console.log('Started');
      this.subscribedInterval = this.interval.subscribe((event) => {
        this.oscillator.frequency.value = Math.random() * 5000 + 160; // Hz

        this.gainNode.connect(this.context.destination);

        const disconnectTimer = this.createValidDisconnectTimer(
          this.playTimeValue$.value,
          this.intervalValueInMilliseconds$.value
        );

        disconnectTimer.subscribe(() =>
          this.gainNode.disconnect(this.context.destination)
        );
      });
    }
  }

  /*
   * Creates timer based on playTimeValue.
   * If playTime is too close to or over the intervalValue it defaults to playTimeMinimum
   */
  private createValidDisconnectTimer(
    playTimeValue: number,
    intervalValueInMilliseconds: number
  ) {
    let disconnectTimer = timer(this.playTimeValue$.value);
    if (playTimeValue <= intervalValueInMilliseconds - 50) {
      disconnectTimer = timer(playTimeValue);
    } else {
      disconnectTimer = timer(this.playTimeMinimum);
    }
    return disconnectTimer;
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
}
