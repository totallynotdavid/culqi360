import { expect, test } from "@playwright/test";

import { decodeStoredRecording } from "./support/audio";
import {
  closeExtensionSession,
  grantMicrophone,
  launchExtensionSession,
  launchUngrantedSession,
  revokeMicrophone,
  sendRuntimeMessage,
  stateOf,
} from "./support/extension-fixture";
import { openOffscreenDocument } from "./support/offscreen";
import { createReceiver } from "./support/receiver";
import {
  beginCall,
  rows,
  startRecording,
  stopRecording,
  waitForChunks,
} from "./support/scenario";

/**
 * Records every `connect` edge in the offscreen document and taps each source
 * that feeds `destination` with an analyser. Headless Linux has no output sink,
 * so the level is read on the feeding node, not behind `destination`. Run it
 * before the recorder builds its graph.
 */
function instrumentAudioGraph(): void {
  const names = new WeakMap<AudioNode, string>();
  const edges: { from: string; to: string; output: number; input: number }[] =
    [];
  const taps: { node: string; analyser: AnalyserNode }[] = [];
  const contexts: BaseAudioContext[] = [];
  const connect: (
    this: AudioNode,
    destination: AudioNode,
    output?: number,
    input?: number,
  ) => AudioNode = AudioNode.prototype.connect;

  let named = 0;
  const nameOf = (node: AudioNode): string => {
    if (!names.has(node)) {
      names.set(node, `${node.constructor.name}#${named++}`);
    }
    return names.get(node) ?? "";
  };

  Reflect.set(
    AudioNode.prototype,
    "connect",
    function (
      this: AudioNode,
      destination: AudioNode,
      output?: number,
      input?: number,
    ): AudioNode {
      if (!contexts.includes(this.context)) {
        contexts.push(this.context);
      }
      edges.push({
        from: nameOf(this),
        to: nameOf(destination),
        output: output ?? 0,
        input: input ?? 0,
      });
      if (destination instanceof AudioDestinationNode) {
        const analyser = this.context.createAnalyser();
        connect.call(this, analyser);
        taps.push({ node: nameOf(this), analyser });
      }
      return connect.call(this, destination, output, input);
    },
  );

  Reflect.set(globalThis, "audioGraph", {
    report() {
      return {
        edges,
        contextStates: contexts.map((context) => context.state),
        taps: taps.map(({ node, analyser }) => {
          const samples = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(samples);
          const sumOfSquares = samples.reduce((sum, v) => sum + v * v, 0);
          return { node, rms: Math.sqrt(sumOfSquares / samples.length) };
        }),
      };
    },
  });
}

interface GraphReport {
  edges: { from: string; to: string; output: number; input: number }[];
  contextStates: string[];
  taps: { node: string; rms: number }[];
}

const kind = (name: string) => name.split("#")[0];

test.describe("the recording holds the agent and the tab on two channels", () => {
  test("puts the microphone on the left and the tab on the right", async () => {
    const receiver = await createReceiver();
    // A failed upload keeps the chunks on disk for decoding.
    receiver.failNext(/PUT .*\/segments\//, 503, 10_000);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 4);
      await stopRecording(call);

      const decoded = await decodeStoredRecording(call.popup);
      expect(decoded.channels).toBe(2);
      expect(decoded.left.rms).toBeGreaterThan(0.01);
      expect(decoded.right.rms).toBeGreaterThan(0.1);
      // The fake tab is a steady 880 Hz tone and the fake microphone beeps at
      // 440 Hz, so each pitch must sit on its own side only. The beep is short
      // and periodic, so its share of the decoded window varies from run to run.
      // The left side is therefore held to its pitch and to the tab's absence
      // measured against the tab's own level, not against the beep's.
      expect(decoded.right.at880).toBeGreaterThan(5 * decoded.right.at440);
      expect(decoded.left.at440).toBeGreaterThan(2 * decoded.left.at880);
      expect(decoded.left.at880).toBeLessThan(0.05 * decoded.right.at880);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("connects the captured tab to the output as well as the recorder", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const offscreen = await openOffscreenDocument(session);
      await offscreen.evaluate(`(${instrumentAudioGraph})()`);

      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 2);

      const graph = await offscreen.evaluate<GraphReport>(
        "audioGraph.report()",
      );
      await stopRecording(call);

      const into = (target: string, input?: number) =>
        graph.edges.filter(
          (edge) =>
            kind(edge.to) === target &&
            (input === undefined || edge.input === input),
        );
      const [micEdge] = into("ChannelMergerNode", 0);
      const [tabEdge] = into("ChannelMergerNode", 1);
      const [outputEdge] = into("AudioDestinationNode");

      expect(micEdge && kind(micEdge.from)).toBe("MediaStreamAudioSourceNode");
      expect(tabEdge && kind(tabEdge.from)).toBe("MediaStreamAudioSourceNode");
      expect(into("AudioDestinationNode")).toHaveLength(1);
      expect(outputEdge?.from).toBe(tabEdge?.from);
      expect(outputEdge?.from).not.toBe(micEdge?.from);
      expect(
        graph.edges.some(
          (edge) =>
            edge.from === tabEdge?.from &&
            kind(edge.to) === "ChannelMergerNode",
        ),
      ).toBe(true);
      expect(
        graph.edges.some(
          (edge) =>
            kind(edge.from) === "ChannelMergerNode" &&
            kind(edge.to) === "MediaStreamAudioDestinationNode",
        ),
      ).toBe(true);
      // The recorder's context and the fake tab's own tone context.
      expect(graph.contextStates).toEqual(["running", "running"]);

      // The tone has amplitude 0.5, so a live feed reads an RMS near 0.35.
      const [tap] = graph.taps;
      expect(tap?.node).toBe(outputEdge?.from);
      expect(tap?.rms).toBeGreaterThan(0.2);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

test.describe("the microphone grant", () => {
  test("fails the recording with the reason, then records once the agent allows it", async () => {
    const receiver = await createReceiver();
    const session = await launchUngrantedSession();

    try {
      const call = await beginCall(session, receiver);
      const refused = await sendRuntimeMessage(call.popup, {
        type: "recording.start",
        tabId: call.callTabId,
      });
      expect(refused).toMatchObject({
        ok: false,
        error: "microphone not allowed",
      });
      expect(await rows(call.popup, "recordings")).toHaveLength(0);

      const panel = await session.context.newPage();
      await panel.goto(
        `chrome-extension://${session.extensionId}/sidepanel.html`,
      );
      const notice = panel.getByTestId("microphone-notice");
      await expect(notice).toHaveText("microphone not allowed");

      const opened = session.context.waitForEvent("page");
      await panel.getByRole("button", { name: "Allow microphone" }).click();
      const permissionPage = await opened;
      await permissionPage.waitForLoadState("domcontentloaded");
      expect(permissionPage.url()).toBe(
        `chrome-extension://${session.extensionId}/permission.html`,
      );
      await expect(permissionPage.locator("#status")).toContainText(
        "microphone not allowed",
      );

      await grantMicrophone(session);
      const closed = permissionPage.waitForEvent("close");
      await permissionPage.reload();
      await closed;
      await expect(notice).toBeHidden();

      await startRecording(call);
      await waitForChunks(call.popup, 2);
      await stopRecording(call);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

test.describe("the microphone ends mid-call", () => {
  test("reports no loss when the recording is stopped normally", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 2);
      await stopRecording(call);
      await expect
        .poll(() => receiver.closes.at(-1)?.answer.status, { timeout: 30_000 })
        .toBe("complete");

      expect(
        receiver.events.filter(
          (event) => event.payload.event === "microphone_lost",
        ),
      ).toHaveLength(0);
      expect((await stateOf(call.popup)).recording.microphoneLost).toBe(false);
      expect(receiver.closes.at(-1)?.manifest.interrupted).toBe(false);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("keeps recording the tab, queues a metric and shows it", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 2);
      const before = (await rows(call.popup, "chunks")).length;

      await revokeMicrophone(session);

      await expect
        .poll(async () => (await stateOf(call.popup)).recording.microphoneLost)
        .toBe(true);
      await waitForChunks(call.popup, before + 2);
      expect((await stateOf(call.popup)).recording.phase).toBe("recording");

      await expect
        .poll(() =>
          receiver.events.filter(
            (event) =>
              event.type === "call.metric" &&
              event.payload.event === "microphone_lost",
          ),
        )
        .toHaveLength(1);
      expect(
        receiver.events.find(
          (event) => event.payload.event === "microphone_lost",
        )?.payload,
      ).toMatchObject({ sessionId: call.callId });

      const panel = await session.context.newPage();
      await panel.goto(
        `chrome-extension://${session.extensionId}/sidepanel.html`,
      );
      await expect(panel.getByTestId("microphone-lost")).toContainText(
        "Microphone disconnected",
      );

      await stopRecording(call);
      await expect
        .poll(() => receiver.closes.at(-1)?.answer.status, { timeout: 30_000 })
        .toBe("complete");
      expect(receiver.closes.at(-1)?.manifest.interrupted).toBe(false);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});
