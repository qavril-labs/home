import React, { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { LiveApiError, liveApi, readLiveSession, saveLiveCompany, type LiveCompany } from "../../lib/live-api";

/**
 * The connection the live screens need: a signed-in session, and the company it works on. Nothing here is mock
 * data. When there is no live session, or the server cannot be reached, the screens say so and show no figures.
 */
export type LiveStatus = "loading" | "signed-out" | "error" | "no-company" | "ready";

export interface LiveContext {
  status: LiveStatus;
  message: string;
  token: string;
  companyId: string;
  companies: LiveCompany[];
  /** The signed-in user's id, so a screen can tell when a person is looking at their own request. */
  userId: string;
  chooseCompany: (companyId: string) => void;
  reconnect: () => void;
}

interface State {
  status: LiveStatus;
  message: string;
  token: string;
  companyId: string;
  companies: LiveCompany[];
  userId: string;
}

const EMPTY: State = { status: "loading", message: "", token: "", companyId: "", companies: [], userId: "" };

export function useLiveContext(): LiveContext {
  const [state, setState] = useState<State>(EMPTY);
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const session = readLiveSession();
    if (!session) {
      setState({ ...EMPTY, status: "signed-out", message: "No live session on this tab." });
      return;
    }
    setState({ ...EMPTY, status: "loading", token: session.token });
    (async () => {
      try {
        const [companies, me] = await Promise.all([liveApi.companies(session.token), liveApi.me(session.token)]);
        if (cancelled) return;
        const userId = me.principal.userId;
        const chosen = companies.find((company) => company.id === session.companyId) ?? (companies.length === 1 ? companies[0] : undefined);
        if (!chosen) {
          setState({
            ...EMPTY,
            status: "no-company",
            token: session.token,
            companies,
            userId,
            message: companies.length === 0 ? "This account has no company yet." : "Choose the company to work on.",
          });
          return;
        }
        saveLiveCompany(chosen.id);
        setState({ status: "ready", message: "", token: session.token, companyId: chosen.id, companies, userId });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof LiveApiError && error.status === 401) {
          setState({ ...EMPTY, status: "signed-out", message: "Your session has ended. Sign in again to see live figures." });
        } else {
          setState({ ...EMPTY, status: "error", token: session.token, message: error instanceof Error ? error.message : "The server cannot be reached right now." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const chooseCompany = useCallback((companyId: string) => {
    saveLiveCompany(companyId);
    setState((current) => ({ ...current, status: "ready", companyId, message: "" }));
  }, []);

  const reconnect = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    status: state.status,
    message: state.message,
    token: state.token,
    companyId: state.companyId,
    companies: state.companies,
    userId: state.userId,
    chooseCompany,
    reconnect,
  };
}

/** Shows the connection state in place of the screen, or the screen itself once it is connected. */
export const LiveFrame: React.FC<{ live: LiveContext; children: React.ReactNode }> = ({ live, children }) => {
  if (live.status === "loading") {
    return <EmptyState title="Connecting" description="Loading your company from the server." />;
  }
  if (live.status === "signed-out") {
    return (
      <EmptyState
        title="Sign in to see live stock"
        description={`${live.message} Sign-in is not connected in this build, so no figures are shown here.`}
      />
    );
  }
  if (live.status === "error") {
    return <EmptyState title="The server cannot be reached" description={live.message} actionLabel="Try again" onAction={live.reconnect} />;
  }
  if (live.status === "no-company") {
    return <CompanyChooser live={live} />;
  }
  return <>{children}</>;
};

const CompanyChooser: React.FC<{ live: LiveContext }> = ({ live }) => {
  const [choice, setChoice] = useState<string>(live.companies[0]?.id ?? "");
  if (live.companies.length === 0) {
    return <EmptyState title="No company yet" description={live.message} />;
  }
  return (
    <Card title="Choose a company" subtitle={live.message}>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <label className="flex flex-col gap-1 text-xs font-bold uppercase text-muted w-full sm:w-auto">
          Company
          <select
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className="bg-page text-text border-line border-thin px-3 py-2 font-body normal-case text-sm"
          >
            {live.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.legalName} ({company.baseCurrency})
              </option>
            ))}
          </select>
        </label>
        <Button variant="lime" onClick={() => live.chooseCompany(choice)} disabled={choice === ""}>
          Use this company
        </Button>
      </div>
    </Card>
  );
};
