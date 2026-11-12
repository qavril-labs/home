import React from "react";
import { Button } from "./Button";
import { Lock, BookOpen } from "lucide-react";

export interface GateProps {
  type: "signed-out" | "setup";
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  statusMessage?: string;
}

export const Gate: React.FC<GateProps> = ({
  type,
  onPrimaryAction,
  onSecondaryAction,
  statusMessage,
}) => {
  if (type === "setup") {
    return (
      <div className="max-w-[580px] mx-auto my-12 p-8 bg-panel border-line shadow-card text-center">
        <div className="w-16 h-16 mx-auto bg-yellow border-line shadow-sm flex items-center justify-center mb-6">
          <BookOpen className="w-8 h-8 text-ink" />
        </div>

        <h2 className="font-display font-extrabold text-2xl uppercase tracking-tight text-text mb-3">
          Let's open your books
        </h2>

        <p className="text-sm text-muted leading-relaxed mb-6">
          We add a ready-made chart of accounts and open this year's periods. It takes a few seconds and you can rename anything later.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="lime" size="lg" onClick={onPrimaryAction}>
            Set up my books
          </Button>
          {onSecondaryAction && (
            <Button variant="ghost" size="lg" onClick={onSecondaryAction}>
              Explore sample demo
            </Button>
          )}
        </div>

        {statusMessage && (
          <p className="text-xs text-good font-semibold mt-4" role="status">
            {statusMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[580px] mx-auto my-12 p-8 bg-panel border-line shadow-card text-center">
      <div className="w-16 h-16 mx-auto bg-lime border-line shadow-sm flex items-center justify-center mb-6">
        <Lock className="w-8 h-8 text-ink" />
      </div>

      <h2 className="font-display font-extrabold text-2xl uppercase tracking-tight text-text mb-3">
        Sign in to see your dashboard
      </h2>

      <p className="text-sm text-muted leading-relaxed mb-6">
        Your session has ended or you have not signed in on this tab yet.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button variant="lime" size="lg" onClick={onPrimaryAction}>
          Sign in
        </Button>
        {onSecondaryAction && (
          <Button variant="ghost" size="lg" onClick={onSecondaryAction}>
            Create a free workspace
          </Button>
        )}
      </div>
    </div>
  );
};
