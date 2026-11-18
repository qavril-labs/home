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
      setError(err instanceof AuthError ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[480px] mx-auto px-4 pt-12">
      <Card title="Sign in">
        <form onSubmit={submit} className="space-y-3" aria-label="Sign in form">
          <label className="block text-sm font-bold">
            Workspace
            <input
              className="mt-1 w-full border-line p-2 bg-panel text-text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              autoComplete="organization"
              required
            />
          </label>
          <label className="block text-sm font-bold">
            Email
            <input
              type="email"
              className="mt-1 w-full border-line p-2 bg-panel text-text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm font-bold">
            Password
            <input
              type="password"
              className="mt-1 w-full border-line p-2 bg-panel text-text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-bold">
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="lime" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
