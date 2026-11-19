import React, { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { signInWithPassword, AuthError } from "../../lib/auth-client";

export interface SignInFormProps {
  onSignedIn: () => void;
  onCancel: () => void;
}

/** Signs in with a workspace, email and password through the core API. The session token it gets back is
 *  the only credential kept, in memory. Nothing is stored in the browser. */
export const SignInForm: React.FC<SignInFormProps> = ({ onSignedIn, onCancel }) => {
  const [workspace, setWorkspace] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(workspace.trim().toLowerCase(), email.trim(), password);
      setPassword("");
      onSignedIn();
    } catch (err) {
      setPassword("");
      setError(
        err instanceof AuthError
          ? err.message
          : "We could not sign you in. Check your workspace, email and password, then try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[480px] w-full mx-auto px-3 sm:px-4 pt-8 sm:pt-12">
      <Card title="Sign in">
        <form onSubmit={submit} className="space-y-4" aria-label="Sign in form" noValidate={false}>
          <div>
            <label htmlFor="signin-workspace" className="block text-xs font-bold uppercase text-muted mb-1">
              Workspace
            </label>
            <input
              id="signin-workspace"
              name="workspace"
              className="w-full border-line p-2 bg-page text-text focus:outline-none focus:ring-2 focus:ring-lime text-sm font-medium"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              autoComplete="organization"
              autoFocus
              required
            />
          </div>

          <div>
            <label htmlFor="signin-email" className="block text-xs font-bold uppercase text-muted mb-1">
              Email
            </label>
            <input
              id="signin-email"
              name="email"
              type="email"
              className="w-full border-line p-2 bg-page text-text focus:outline-none focus:ring-2 focus:ring-lime text-sm font-medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label htmlFor="signin-password" className="block text-xs font-bold uppercase text-muted mb-1">
              Password
            </label>
            <input
              id="signin-password"
              name="password"
              type="password"
              className="w-full border-line p-2 bg-page text-text focus:outline-none focus:ring-2 focus:ring-lime text-sm font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-2.5 bg-act/10 border-line border-act text-xs font-bold text-act flex items-center gap-2"
            >
              <span className="shrink-0 font-bold">!</span>
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="lime" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </div>

          {/* Status line below the form (docs/ui-contract.md section 4 QuickEntryForm pattern) */}
          {error ? (
            <p
              role="status"
              className="text-xs font-mono font-bold text-act bg-page p-2 border border-grid text-center"
            >
              Sign-in paused · Check your details above.
            </p>
          ) : busy ? (
            <p
              role="status"
              className="text-xs font-mono font-bold text-muted bg-page p-2 border border-grid text-center"
            >
              Signing in to your workspace…
            </p>
          ) : (
            <p
              role="status"
              className="text-xs font-mono text-muted bg-page p-2 border border-grid text-center"
            >
              Session credentials stay in memory. Nothing is stored in the browser.
            </p>
          )}
        </form>
      </Card>
    </div>
  );
};
