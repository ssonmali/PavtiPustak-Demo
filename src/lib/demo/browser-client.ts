"use client";

/**
 * The browser half of the demo backend.
 *
 * In the app the browser client does exactly two things — subscribe to table
 * changes so every volunteer's page stays current, and publish presence so two
 * people cannot silently edit the same receipt. Neither needs a database, so
 * this fakes both over `BroadcastChannel`, which reaches the other tabs of the
 * same browser. Open the demo twice side by side and the live-sync badge, the
 * cross-tab refresh and the "Sunil Kaka has this open" warning all behave
 * exactly as they do for two volunteers on two phones.
 */

import { JOURNAL_COOKIE } from "./config";

type Handler = (payload: unknown) => void;
/**
 * The full set supabase-js reports. Only two can ever happen here, but the app
 * branches on all of them and narrowing the type would make those branches
 * unreachable code rather than the fallbacks they are.
 */
type Status = "SUBSCRIBED" | "CLOSED" | "CHANNEL_ERROR" | "TIMED_OUT";

type DemoSession = { access_token: string };

const CHANNEL_PREFIX = "pp-demo:";

/** No-op stand-in for browsers without BroadcastChannel (older iOS Safari). */
const bus = (name: string) => {
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(CHANNEL_PREFIX + name);
};

type PresenceMessage = { type: "presence"; key: string; payload: unknown | null };
type ChangeMessage = { type: "change"; table: string };

/** How often a tab checks whether the ledger changed underneath it. */
const JOURNAL_POLL = 1000;

const readJournal = () =>
  document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${JOURNAL_COOKIE}=`)) ?? "";

class DemoChannel {
  private handlers: Handler[] = [];
  private presenceHandlers: Handler[] = [];
  private presence = new Map<string, unknown[]>();
  private socket: BroadcastChannel | null;
  /** Set only on the table-changes channel — see `watchJournal`. */
  private poll: ReturnType<typeof setInterval> | undefined;
  private journal = "";
  /** This tab's own presence key — stable for the life of the channel. */
  private key = Math.random().toString(36).slice(2);

  constructor(name: string) {
    // Assigned here rather than as a field initializer: the field would need
    // `name` before the parameter property is assigned.
    this.socket = bus(name);
    if (!this.socket) return;
    this.socket.onmessage = (event: MessageEvent<PresenceMessage | ChangeMessage>) => {
      const message = event.data;
      if (message?.type === "change") {
        for (const handler of this.handlers) handler({ table: message.table });
        return;
      }
      if (message?.type === "presence") {
        if (message.payload === null) this.presence.delete(message.key);
        else this.presence.set(message.key, [message.payload]);
        for (const handler of this.presenceHandlers) handler({ event: "sync" });
      }
    };
  }

  on(event: string, _filter: unknown, handler?: Handler) {
    if (event === "presence") {
      // The app passes ("presence", { event: "sync" }, handler).
      if (handler) this.presenceHandlers.push(handler);
      return this;
    }
    if (handler) this.handlers.push(handler);
    return this;
  }

  /**
   * Notices a write made by another tab.
   *
   * There is no server pushing events here, and the tab that made the change
   * cannot post to itself before the Server Action has returned. What every tab
   * *can* see is the journal cookie the write lands in, so a second of latency
   * buys cross-tab sync without the app knowing anything has changed. Open the
   * demo twice and it behaves like two volunteers' phones.
   */
  private watchJournal() {
    if (typeof document === "undefined") return;
    this.journal = readJournal();
    this.poll = setInterval(() => {
      const current = readJournal();
      if (current === this.journal) return;
      this.journal = current;
      for (const handler of this.handlers) handler({ table: "receipts" });
    }, JOURNAL_POLL);
  }

  subscribe(callback?: (status: Status) => void) {
    // Only the table-changes channel has table handlers; the presence channel
    // has nothing a cookie could tell it.
    if (this.handlers.length) this.watchJournal();
    // Async, like a real join: the presence effect waits on the ack, and firing
    // it synchronously would have it run before React has committed.
    setTimeout(() => callback?.(this.socket ? "SUBSCRIBED" : "CLOSED"), 0);
    return this;
  }

  presenceState<T>() {
    return Object.fromEntries(this.presence) as Record<string, T[]>;
  }

  async track(payload: unknown) {
    this.presence.set(this.key, [payload]);
    this.socket?.postMessage({ type: "presence", key: this.key, payload });
  }

  async untrack() {
    this.presence.delete(this.key);
    this.socket?.postMessage({ type: "presence", key: this.key, payload: null });
  }

  close() {
    clearInterval(this.poll);
    void this.untrack();
    this.socket?.close();
  }
}

export function createDemoBrowserClient() {
  return {
    channel(name: string, _options?: unknown) {
      void _options;
      return new DemoChannel(name);
    },

    removeChannel(channel: DemoChannel) {
      channel.close();
    },

    realtime: {
      async setAuth(_token: string) {
        void _token;
      },
    },

    auth: {
      async getSession() {
        // Enough for the two callers: they only read `access_token` to hand it
        // to `realtime.setAuth`, which the demo does not need.
        return { data: { session: { access_token: "demo" } }, error: null };
      },

      onAuthStateChange(
        _callback: (event: string, session: DemoSession | null) => void,
      ) {
        // Nothing ever fires it: there is no token to refresh.
        void _callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
}
