import { Component, OnDestroy, OnInit } from '@angular/core';
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
    switchMap((value) => interval(value))
  );

  playTimeValue$ = new BehaviorSubject(500);
  playTimeMinimum = 50;

  volume$ = new BehaviorSubject(0.1);

  context: AudioContext;
  oscillator: OscillatorNode;
  gainNode: GainNode;

  subscribedInterval: Subscription;

  subs = new SubSink();

  constructor() {}

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    stop();
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
    this.oscillator.frequency.value = 240; // Hz
  }

  private createContext() {
    this.context = new window.AudioContext();
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = this.volume$.value;
    this.subs.sink = this.volume$.subscribe((volume) => {
      this.gainNode.gain.value = volume;
    });
  }

  sliderChanged(event: { target: HTMLInputElement }) {
    console.log(`Volume: ${event.target.valueAsNumber}`);
    this.volume$.next(event.target.valueAsNumber);
  }

  intervalChanged(event: { target: HTMLInputElement }) {
    const intervalValue = event.target.valueAsNumber;
    console.log(`Interval: ${intervalValue}`);
    this.intervalValueInMilliseconds$.next(intervalValue);

    if (intervalValue - 100 <= this.playTimeValue$.value) {
      if (intervalValue - 100 < 50) {
        this.playTimeValue$.next(50);
      } else {
        this.playTimeValue$.next(intervalValue - 100);
      }
    }
  }

  playTimeChanged(event: { target: HTMLInputElement }) {
    const playTimeValue = event.target.valueAsNumber;
    console.log(`Play time: ${playTimeValue}`);
    this.playTimeValue$.next(playTimeValue);

    if (playTimeValue + 100 >= this.intervalValueInMilliseconds$.value) {
      this.intervalValueInMilliseconds$.next(playTimeValue + 100);
    }
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
}
