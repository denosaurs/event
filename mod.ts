// Copyright 2020-present the denosaurs team. All rights reserved. MIT license.

export default class EventEmitter<E extends Record<string, unknown[]>> {
  listeners: {
    [K in keyof E]?: Array<{
      once: boolean;
      cb: (...args: E[K]) => void;
    }>;
  } = Object.create(null);
  #writer: WritableStreamDefaultWriter<{
    name: keyof E;
    value: E[keyof E];
  }>[] = [];
  #onWriters: {
    [K in keyof E]?: WritableStreamDefaultWriter<E[K]>[];
  } = Object.create(null);

  /**
   * Appends the listener to the listeners array of the corresponding eventName.
   * No checks are made if the listener was already added, so adding multiple
   * listeners will result in the listener being called multiple times.
   */
  on<K extends keyof E>(eventName: K, listener: (...args: E[K]) => void): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName]!.push({
      once: false,
      cb: listener,
    });
  }

  /**
   * Returns an asyncIterator which will fire every time eventName is emitted.
   */
  async* asyncOn<K extends keyof E>(eventName: K): AsyncIterableIterator<E[K]> {
    if (!this.#onWriters[eventName]) {
      this.#onWriters[eventName] = [];
    }

    const {readable, writable} = new TransformStream<E[K], E[K]>();
    this.#onWriters[eventName]!.push(writable.getWriter());
    yield* readable.getIterator();
  }

  /**
   * Adds a one-time listener function for the event named eventName. The next
   * time eventName is emitted, listener is called and then removed.
   */
  once<K extends keyof E>(eventName: K, listener: (...args: E[K]) => void) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName]!.push({
      once: true,
      cb: listener,
    });
  }

  /**
   * Removes the listener from eventName.
   * If no listener is passed, all listeners will be removed from eventName.
   * If no eventName is passed, all listeners will be removed from the EventEmitter.
   */
  off<K extends keyof E>(eventName?: K, listener?: (...args: E[K]) => void) {
    if (eventName) {
      if (listener) {
        this.listeners[eventName] = this.listeners[eventName]?.filter(
          ({cb}) => cb !== listener,
        );
      } else {
        delete this.listeners[eventName];
      }
    } else {
      this.listeners = Object.create(null);
    }
  }

  /**
   * Synchronously calls each of the listeners registered for the event named
   * eventName, in the order they were registered, passing the supplied
   * arguments to each.
   */
  emit<K extends keyof E>(eventName: K, ...args: E[K]) {
    const listeners = this.listeners[eventName]?.slice() ?? [];
    for (const {cb, once} of listeners) {
      cb(...args);

      if (once) {
        this.off(eventName, cb);
      }
    }

    for (const writer of this.#writer) {
      writer.write({
        name: eventName,
        value: args,
      });
    }
    if (this.#onWriters[eventName]) {
      for (const writer of this.#onWriters[eventName]!) {
        writer.write(args);
      }
    }
  }

  async* [Symbol.asyncIterator](): AsyncIterableIterator<{
    [K in keyof E]: {
      name: K;
      value: E[K];
    };
  }[keyof E]> {
    const {readable, writable} = new TransformStream<{
      name: keyof E;
      value: E[keyof E];
    }, {
      name: keyof E;
      value: E[keyof E];
    }>();
    this.#writer.push(writable.getWriter());
    yield * readable.getIterator();
  }
}
