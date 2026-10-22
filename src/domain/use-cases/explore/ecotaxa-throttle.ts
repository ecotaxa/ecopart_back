// At most `max_in_flight` calls at a time towards EcoTaxa from the Explore page, whoever asks: the
// Explore requests, the refresh queue and the daily sweep share it, so that EcoTaxa never sees more
// than a couple of EcoPart queries at once. A finishing call hands its slot straight to the first
// waiter, so that a call arriving meanwhile cannot slip in front of it.
export class EcoTaxaThrottle {
    private in_flight = 0;
    private readonly waiting: (() => void)[] = [];

    constructor(private readonly max_in_flight: number) { }

    async run<T>(call: () => Promise<T>): Promise<T> {
        if (this.in_flight >= this.max_in_flight) {
            // Resumed with the slot of the call that woke us.
            await new Promise<void>(resolve => this.waiting.push(resolve));
        } else {
            this.in_flight++;
        }
        try {
            return await call();
        } finally {
            const next = this.waiting.shift();
            if (next) next();
            else this.in_flight--;
        }
    }

    get pending(): number { return this.in_flight + this.waiting.length; }
}
