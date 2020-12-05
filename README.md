# event

[![Tags](https://img.shields.io/github/release/denosaurs/event)](https://github.com/denosaurs/event/releases)
[![CI Status](https://img.shields.io/github/workflow/status/denosaurs/event/check)](https://github.com/denosaurs/event/actions)
[![Dependencies](https://img.shields.io/github/workflow/status/denosaurs/event/depsbot?label=dependencies)](https://github.com/denosaurs/depsbot)
[![License](https://img.shields.io/github/license/denosaurs/event)](https://github.com/denosaurs/event/blob/master/LICENSE)

Strictly typed event emitter with asynciterator support.

Events should be defined as a literal object type where the key is the event name, and the value is a tuple with any amount of elements of any type.

---
> ⚠️ Events must be a type, and can't be an interface due to their design differences.
---

```ts
type Events = {
  foo: [string];
  bar: [number, boolean];
};

class MyClass extends EventEmitter<Events> {}
const MyClassInstance = new MyClass();

function listener(num, bool) {}

// add a listener to the bar event
MyClassInstance.on("bar", listener);

// remove a listener from the bar event
MyClassInstance.off("bar", listener);

// add a one-time listener to the bar event
MyClassInstance.once("bar", (num, bool) => {});

// on, once, and off are chainable
MyClassInstance.on("bar", listener).off("bar", listener);

// emit the bar event with the wanted data
MyClassInstance.emit("bar", 42, true);

// listen to all events with an async iterator
for await (const event of MyClassInstance) {
  if (event.name === "bar") {
    // event.value is of type [number, boolean]
  }
}

// listen to a specific event with an async iterator
for await (const [num, bool] of MyClassInstance.asyncOn("bar")) {
}
```

## Maintainers

- crowlKats ([@crowlKats](https://github.com/crowlKats))

## Other

### Contribution

Pull request, issues and feedback are very welcome. Code style is formatted with `deno fmt` and commit messages are done following Conventional Commits spec.

### Licence

Copyright 2020-present, the denosaurs team. All rights reserved. MIT license.
