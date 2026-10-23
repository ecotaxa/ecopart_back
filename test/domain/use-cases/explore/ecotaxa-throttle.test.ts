import { EcoTaxaThrottle } from "../../../../src/domain/use-cases/explore/ecotaxa-throttle";

interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
}

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

// Lets every pending promise reaction run.
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

describe("EcoTaxaThrottle", () => {
    test("with 2 slots, a third call starts only when one of the first two finishes", async () => {
        const throttle = new EcoTaxaThrottle(2);
        const calls = [deferred<string>(), deferred<string>(), deferred<string>()];
        const started: number[] = [];
        const runs = calls.map((call, i) => throttle.run(() => { started.push(i); return call.promise; }));

        await flush();
        expect(started).toEqual([0, 1]);
        expect(throttle.pending).toBe(3);

        calls[1].resolve("second");
        await expect(runs[1]).resolves.toBe("second");
        await flush();
        expect(started).toEqual([0, 1, 2]);
        expect(throttle.pending).toBe(2);

        calls[0].resolve("first");
        calls[2].resolve("third");
        await expect(Promise.all(runs)).resolves.toEqual(["first", "second", "third"]);
        expect(throttle.pending).toBe(0);
    });

    test("the waiting calls start in the order they came", async () => {
        const throttle = new EcoTaxaThrottle(1);
        const calls = [deferred<void>(), deferred<void>(), deferred<void>(), deferred<void>()];
        const started: number[] = [];
        const runs = calls.map((call, i) => throttle.run(() => { started.push(i); return call.promise; }));

        for (let i = 0; i < calls.length; i++) {
            await flush();
            expect(started).toEqual(Array.from({ length: i + 1 }, (_, k) => k));
            expect(throttle.pending).toBe(calls.length - i);
            calls[i].resolve();
        }
        await Promise.all(runs);
        expect(throttle.pending).toBe(0);
    });

    test("a throwing call releases its slot and its error reaches the caller", async () => {
        const throttle = new EcoTaxaThrottle(1);
        const failing = deferred<number>();
        let second_started = false;

        const first = throttle.run(() => failing.promise);
        const second = throttle.run(async () => { second_started = true; return 2; });
        await flush();
        expect(second_started).toBe(false);
        expect(throttle.pending).toBe(2);

        failing.reject(new Error("EcoTaxa answered 503"));
        await expect(first).rejects.toThrow("EcoTaxa answered 503");
        await expect(second).resolves.toBe(2);
        expect(second_started).toBe(true);
        expect(throttle.pending).toBe(0);
    });

    test("a call that throws synchronously releases its slot too", async () => {
        const throttle = new EcoTaxaThrottle(1);

        await expect(throttle.run(() => { throw new Error("bad query"); })).rejects.toThrow("bad query");
        expect(throttle.pending).toBe(0);
        await expect(throttle.run(async () => "next")).resolves.toBe("next");
    });

    test("never more than max_in_flight calls at once, under many concurrent callers", async () => {
        const throttle = new EcoTaxaThrottle(2);
        let in_flight = 0;
        let max_seen = 0;
        const runs = Array.from({ length: 20 }, (_, i) => throttle.run(async () => {
            in_flight++;
            max_seen = Math.max(max_seen, in_flight);
            await new Promise<void>(resolve => setTimeout(resolve, i % 3));
            in_flight--;
            return i;
        }));

        await expect(Promise.all(runs)).resolves.toEqual(Array.from({ length: 20 }, (_, i) => i));
        expect(max_seen).toBe(2);
        expect(throttle.pending).toBe(0);
    });

    test("a call arriving while a slot is being handed over neither exceeds the limit nor jumps the queue", async () => {
        const throttle = new EcoTaxaThrottle(1);
        const a = deferred<void>();
        const b = deferred<void>();
        const c = deferred<void>();
        const started: string[] = [];
        const finished = new Set<string>();
        let max_seen = 0;
        const call = (name: string, done: Deferred<void>) => () => {
            started.push(name);
            max_seen = Math.max(max_seen, started.filter(other => !finished.has(other)).length);
            return done.promise;
        };

        const run_a = throttle.run(call("A", a));
        const run_b = throttle.run(call("B", b));
        await flush();
        expect(started).toEqual(["A"]);

        // A finishes, and in the same microtask flush another flow asks for C.
        let run_c: Promise<void> | null = null;
        finished.add("A");
        a.resolve();
        Promise.resolve().then(() => { run_c = throttle.run(call("C", c)); });
        await flush();

        expect(started).toEqual(["A", "B"]);
        expect(max_seen).toBe(1);

        finished.add("B");
        b.resolve();
        finished.add("C");
        c.resolve();
        await Promise.all([run_a, run_b, run_c]);
    });
});
