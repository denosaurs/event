import { assertEquals, assertThrows, fail } from "jsr:@std/assert@0.218";
import { EventEmitter } from "./mod.ts";

type Events = {
  foo: [string];
  bar: [number];
};

Deno.test("on", () => {
  const ee = new EventEmitter<Events>();

  ee.on("foo", (string) => {
    assertEquals(string, "bar");
  });

  ee.emit("foo", "bar");
});

Deno.test("once", () => {
  const ee = new EventEmitter<Events>();

  ee.once("foo", (string) => {
    assertEquals(string, "bar");
  });

  ee.emit("foo", "bar");
});

Deno.test("async once", async () => {
  const ee = new EventEmitter<Events>();

  const once = ee.once("foo");

  await ee.emit("foo", "bar");

  const [val] = await once;
  assertEquals(val, "bar");
});

Deno.test("off", () => {
  const ee = new EventEmitter<Events>();

  function foo() {
    fail();
  }

  ee.on("foo", foo);
  ee.off("foo", foo);

  ee.emit("foo", "bar");
});

Deno.test("offEvent", () => {
  const ee = new EventEmitter<Events>();

  let i = 0;

  ee.on("foo", () => i++);
  ee.on("foo", () => i++);
  ee.off();

  ee.emit("foo", "bar");

  assertEquals(i, 0);
});

Deno.test("offAll", () => {
  const ee = new EventEmitter<Events>();

  let i = 0;

  ee.on("foo", () => i++);
  ee.on("bar", () => i++);
  ee.off();

  ee.emit("foo", "bar");

  assertEquals(i, 0);
});

Deno.test("chainable", () => {
  const ee = new EventEmitter<Events>();

  function foo() {
    fail();
  }

  ee.on("foo", foo).off("foo", foo);

  ee.emit("foo", "bar");
});

Deno.test("asyncIterator", async () => {
  const ee = new EventEmitter<Events>();
  setTimeout(() => {
    ee.emit("foo", "bar");
  }, 100);
  const event = (await ee[Symbol.asyncIterator]().next()).value;

  assertEquals(event.name, "foo");
  assertEquals(event.value, ["bar"]);
});

Deno.test("on AsyncIterator", async () => {
  const ee = new EventEmitter<Events>();
  setTimeout(() => {
    ee.emit("foo", "bar");
  }, 100);
  const value = (await ee.on("foo").next()).value;

  assertEquals(value, ["bar"]);
});

Deno.test("closeEvent", async () => {
  const ee = new EventEmitter<Events>();
  setTimeout(() => {
    ee.emit("foo", "bar");
  }, 100);

  let i = 0;

  (async () => {
    for await (const _ of ee.on("foo")) {
      //
    }
    i++;
  })();

  for await (const _ of ee.on("foo")) {
    await ee.off("foo");
  }

  assertEquals(i, 1);
});

Deno.test("closeGlobal", async () => {
  const ee = new EventEmitter<Events>();
  setTimeout(() => {
    ee.emit("foo", "bar");
  }, 100);

  let i = 0;

  (async () => {
    for await (const _ of ee) {
      //
    }
    i++;
  })();

  for await (const _ of ee) {
    await ee.off();
  }

  assertEquals(i, 1);
});

Deno.test("closeMixed", async () => {
  const ee = new EventEmitter<Events>();
  setTimeout(() => {
    ee.emit("foo", "bar");
  }, 100);

  (async () => {
    for await (const _ of ee.on("foo")) {
      //
    }
  })();

  for await (const _x of ee) {
    await ee.off();
  }
});

Deno.test("limitReached", () => {
  const ee = new EventEmitter<Events>(1);

  ee.on("foo", () => {});
  assertThrows(() => ee.on("foo", () => {}));
});
