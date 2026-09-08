'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Intent composer — §5.18, §13.1.
 *
 * Typed input and spoken input have equal functionality. Microphone access is requested only
 * when the control is activated, and a denial keeps every typed path working.
 *
 * The authoring conveyor is not connected in this build (§10). Rather than presenting a canned
 * draft as live authoring, submission reports the integration state and preserves the intent
 * locally so nothing the user wrote is lost.
 */

type MicState = 'idle' | 'unsupported' | 'requesting' | 'recording' | 'denied' | 'error';

const STORAGE_KEY = 'sidefx.retained-intent';

export function IntentComposer({ startingFrom }: { startingFrom?: string }) {
  const [intent, setIntent] = useState('');
  const [micState, setMicState] = useState<MicState>('idle');
  const [submitted, setSubmitted] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  // The intent is retained locally so a reload, a sign-in detour or a failed submission
  // never discards what the user wrote (§13.3).
  useEffect(() => {
    try {
      const retained = window.localStorage.getItem(STORAGE_KEY);
      if (retained) setIntent(retained);
    } catch {
      // Storage can be unavailable; the composer still works without retention.
    }
  }, []);

  useEffect(() => {
    try {
      if (intent) window.localStorage.setItem(STORAGE_KEY, intent);
    } catch {
      // Ignore: retention is a convenience, not a requirement.
    }
  }, [intent]);

  const startListening = () => {
    interface SpeechRecognitionLike {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      stop: () => void;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!Recognition) {
      setMicState('unsupported');
      return;
    }

    setMicState('requesting');
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i]?.[0]?.transcript ?? '';
      }
      // The transcript is editable text, never a committed instruction.
      setIntent((current) => (current ? `${current} ${transcript.trim()}` : transcript.trim()));
    };
    recognition.onerror = (event) => {
      setMicState(event.error === 'not-allowed' ? 'denied' : 'error');
    };
    recognition.onend = () => {
      setMicState((state) => (state === 'recording' ? 'idle' : state));
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setMicState('recording');
    } catch {
      setMicState('error');
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setMicState('idle');
  };

  const micMessage: Record<MicState, string> = {
    idle: '',
    unsupported:
      'This browser does not provide speech recognition. Typing an intent has exactly the same effect.',
    requesting: 'Requesting microphone access…',
    recording: 'Recording. Your words are added to the editable intent below; audio is not retained.',
    denied:
      'Microphone access was denied. Typing an intent has exactly the same effect — nothing is lost.',
    error: 'Speech recognition stopped unexpectedly. You can try again or type the intent instead.',
  };

  return (
    <div className="rounded-lg border border-grid-line bg-ink-2 p-5 sm:p-6">
      {startingFrom ? (
        <p className="mb-4 rounded border border-authority/40 p-3 text-sm">
          Starting from{' '}
          <span className="break-all font-mono text-xs text-authority">{startingFrom}</span>. A new
          draft would be created with that lineage; the source capability is never modified.
        </p>
      ) : null}

      <label htmlFor="intent" className="block font-mono text-xs uppercase tracking-widest text-muted">
        What capability do you need?
      </label>
      <textarea
        id="intent"
        value={intent}
        onChange={(event) => {
          setIntent(event.target.value);
          setSubmitted(false);
        }}
        rows={5}
        placeholder="Describe the capability in your own words. For example: connect to a market data provider and retrieve the latest quote for a given company symbol."
        aria-describedby="intent-help mic-status"
        className="mt-2 w-full rounded border border-grid-line bg-ink px-3 py-3 text-base"
      />
      <p id="intent-help" className="mt-2 text-xs text-muted">
        Your intent stays on this device until you submit it. Speaking and typing produce the same
        editable text.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={micState === 'recording' ? stopListening : startListening}
          aria-pressed={micState === 'recording'}
          className="rounded border border-grid-line px-4 py-2 text-sm hover:border-signal"
        >
          {micState === 'recording' ? 'Stop recording' : 'Speak your intent'}
        </button>
        <button
          type="button"
          onClick={() => {
            setSubmitted(true);
            statusRef.current?.focus();
          }}
          disabled={intent.trim().length === 0}
          className="rounded bg-signal px-5 py-2 text-sm font-semibold text-ink disabled:opacity-40"
        >
          Design circuit
        </button>
        {intent ? (
          <button
            type="button"
            onClick={() => {
              setIntent('');
              setSubmitted(false);
              try {
                window.localStorage.removeItem(STORAGE_KEY);
              } catch {
                // Nothing to clear.
              }
            }}
            className="rounded border border-grid-line px-4 py-2 text-sm hover:border-signal"
          >
            Clear
          </button>
        ) : null}
      </div>

      <p id="mic-status" aria-live="polite" className="mt-3 text-sm text-telemetry">
        {micMessage[micState]}
      </p>

      {submitted ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className="mt-5 rounded border border-failure/40 bg-ink p-4"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Not available</p>
          <h3 className="mt-1 font-display text-base font-semibold">
            The authoring conveyor is not connected in this build
          </h3>
          <p className="mt-2 text-sm text-muted">
            Submitting an intent requires the Gemini Pro authoring conveyor, an authenticated
            workspace and the candidate-to-authority adapter. Those are open integration
            dependencies, so no circuit is designed here and no canned draft is shown in place of
            one.
          </p>
          <p className="mt-2 text-sm text-muted">
            Your intent has been kept on this device. You can inspect real published capability
            circuits in the meantime.
          </p>
        </div>
      ) : null}
    </div>
  );
}
