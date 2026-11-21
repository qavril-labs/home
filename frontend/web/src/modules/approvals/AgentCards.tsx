import React from "react";
import { BotCard } from "../../components/ui/BotCard";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import type { BotInsight, StatusType } from "../../types";
import type { UaapAgent } from "../../lib/uaap-client";

/** Accent colours from tokens.json, one per bot, so each bot keeps its colour everywhere. */
const BOT_COLORS: Record<string, string> = {
  "universal-finance-agent": "violet",
  "approval-agent": "cyan",
  "ledger-invariant-checker": "lime",
  "approval-reminder": "yellow",
};

/** First sentence of a purpose statement, for the card's role line. */
function firstSentence(text: string): string {
  const cut = text.indexOf(". ");
  return cut === -1 ? text : text.slice(0, cut + 1);
}

/** Builds a bot card from the API's record only. Nothing is invented: counts come from the inbox. */
export function toBotInsight(agent: UaapAgent, pending: number): BotInsight {
  let status: StatusType = "good";
  let statusText = "All good";
  if (!agent.enabled) {
    status = "idle";
    statusText = "Switched off";
  } else if (pending > 0) {
    status = "act";
    statusText = "Needs you";
  }
  const example = agent.use_cases[0]?.example ?? "";
  return {
    id: agent.agent_id,
    name: agent.name,
    role: firstSentence(agent.purpose),
    color: BOT_COLORS[agent.agent_id] ?? "lime",
    status,
    statusText,
    foundText: !agent.enabled
      ? "Not running. An administrator can switch it on."
      : pending > 0
        ? `${pending} waiting for a decision`
        : "Nothing waiting.",
    nextText: example ? `Try: "${example}"` : "Ask it a question in the bot service.",
  };
}

export interface AgentCardsProps {
  agents: UaapAgent[];
  pendingFor: (agentId: string) => number;
}

export const AgentCards: React.FC<AgentCardsProps> = ({ agents, pendingFor }) => {
  return (
    <Card title="Your bots" className="mb-6">
      {agents.length === 0 ? (
        <EmptyState
          title="No bots are connected yet"
          description="Bots appear here once the bot service is connected and you are signed in."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Bots">
          {agents.map((agent) => (
            <BotCard key={agent.agent_id} bot={toBotInsight(agent, pendingFor(agent.agent_id))} />
          ))}
        </div>
      )}
    </Card>
  );
};
