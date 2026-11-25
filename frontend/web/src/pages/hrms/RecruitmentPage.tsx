import React, { useState } from "react";
import { Card } from "../../components/ui/Card";
import { KpiTile } from "../../components/ui/KpiTile";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import {
  mockApplications,
  mockOffers,
  mockRejectionReasons,
} from "../../modules/hrms/mock-api";
import { mapHrmStatus } from "../../modules/hrms/status-map";
import type {
  CandidateApplication,
  CandidateStage,
  Offer,
} from "../../modules/hrms/types";

const STAGES: CandidateStage[] = [
  "applied",
  "screened",
  "shortlisted",
  "interviewing",
  "selected",
  "offer_stage",
  "hired",
  "rejected",
  "withdrawn",
];

export const RecruitmentPage: React.FC = () => {
  const { showToast } = useToast();
  const [applications, setApplications] = useState<CandidateApplication[]>(mockApplications);
  const [offers, setOffers] = useState<Offer[]>(mockOffers);

  const [selectedApp, setSelectedApp] = useState<CandidateApplication | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  const [rejectTarget, setRejectTarget] = useState<CandidateApplication | null>(null);
  const [rejectReasonCode, setRejectReasonCode] = useState(mockRejectionReasons[0]!.code);

  const [techScore, setTechScore] = useState(4);
  const [commScore, setCommScore] = useState(4);
  const [cultScore, setCultScore] = useState(4);
  const [rec, setRec] = useState<"strong_hire" | "hire" | "no_hire">("hire");

  const [offerAction, setOfferAction] = useState<{
    offer: Offer;
    type: "send" | "withdraw";
  } | null>(null);

  const moveStage = (app: CandidateApplication, nextStage: CandidateStage) => {
    if (nextStage === "rejected") {
      setRejectTarget(app);
      return;
    }
    setApplications((prev) =>
      prev.map((a) =>
        a.id === app.id
          ? {
              ...a,
              stage: nextStage,
              stageHistory: [
                ...a.stageHistory,
                { stage: nextStage, changedAt: "2026-11-24", by: "Current User" },
              ],
            }
          : a
      )
    );
    showToast(`Moved ${app.candidateName} to ${nextStage.replace("_", " ")}`, "success");
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    setApplications((prev) =>
      prev.map((a) =>
        a.id === rejectTarget.id
          ? {
              ...a,
              stage: "rejected",
              stageHistory: [
                ...a.stageHistory,
                { stage: "rejected", changedAt: "2026-11-24", by: `Current User (${rejectReasonCode})` },
              ],
            }
          : a
      )
    );
    showToast(`Rejected ${rejectTarget.candidateName}`, "info");
    setRejectTarget(null);
  };

  const handleSubmitScorecard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    const updated: CandidateApplication = {
      ...selectedApp,
      currentUserSubmittedScorecard: true,
      scorecards: selectedApp.scorecards.map((sc) =>
        sc.panelistId === "user-current"
          ? {
              ...sc,
              submitted: true,
              technicalScore: techScore,
              communicationScore: commScore,
              cultureScore: cultScore,
              recommendation: rec,
            }
          : sc
      ),
    };
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedApp(updated);
    showToast("Scorecard submitted", "success");
  };

  const handleOfferConfirm = () => {
    if (!offerAction) return;
    const { offer, type } = offerAction;
    const nextStatus = type === "send" ? "sent" : "withdrawn";
    setOffers((prev) =>
      prev.map((o) => (o.id === offer.id ? { ...o, status: nextStatus } : o))
    );
    if (selectedOffer?.id === offer.id) {
      setSelectedOffer({ ...offer, status: nextStatus });
    }
    showToast(
      type === "send"
        ? `Sent offer to ${offer.candidateName}`
        : `Withdrew offer for ${offer.candidateName}`,
      "success"
    );
    setOfferAction(null);
  };

  const handleAcceptOffer = (offer: Offer) => {
    if (offer.isExpired) return;
    setOffers((prev) =>
      prev.map((o) => (o.id === offer.id ? { ...o, status: "accepted" } : o))
    );
    setSelectedOffer({ ...offer, status: "accepted" });
    showToast(`Offer accepted by ${offer.candidateName}`, "success");
  };

  const offerCols: Column<Offer>[] = [
    { header: "Candidate", cell: (r) => <span className="font-bold">{r.candidateName}</span> },
    { header: "Position", cell: (r) => r.positionTitle },
    { header: "Total CTC", align: "right", cell: (r) => formatMoney(r.totalAnnualCtc) },
    {
      header: "Band",
      cell: (r) => (
        <StatusChip
          status={r.bandStatus === "within_band" ? "good" : "watch"}
          label={r.bandMessage}
        />
      ),
    },
    {
      header: "Status",
      cell: (r) => {
        const m = mapHrmStatus(r.status);
        return <StatusChip status={m.status} label={m.label} />;
      },
    },
    {
      header: "",
      align: "right",
      cell: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setSelectedOffer(r)}>
          Open Offer
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted">HRM-09</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            Recruitment & Offers
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Active Candidates" value={String(applications.length)} variant="lime" />
        <KpiTile label="Interviewing" value={String(applications.filter((a) => a.stage === "interviewing").length)} variant="yellow" />
        <KpiTile label="Offers Sent" value={String(offers.filter((o) => o.status === "sent").length)} variant="panel" />
        <KpiTile label="Offers Accepted" value={String(offers.filter((o) => o.status === "accepted").length)} variant="panel" />
      </div>

      <Card title="Candidate Pipeline">
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-[900px]">
            {STAGES.map((stage) => {
              const items = applications.filter((a) => a.stage === stage);
              return (
                <div
                  key={stage}
                  className="w-56 shrink-0 bg-page border-3 border-border p-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between border-b-2 border-border pb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {stage.replace("_", " ")}
                    </span>
                    <span className="text-xs font-mono font-bold">{items.length}</span>
                  </div>
                  {items.map((app) => (
                    <div
                      key={app.id}
                      className="p-2.5 bg-panel border-2 border-border space-y-2"
                    >
                      <div className="font-bold text-sm">{app.candidateName}</div>
                      <div className="text-xs text-text-muted">{app.positionTitle}</div>
                      {app.duplicateFlag && (
                        <StatusChip status="watch" label="Possible duplicate" />
                      )}
                      <div className="flex flex-wrap gap-1 pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedApp(app)}
                        >
                          View
                        </Button>
                        {stage !== "rejected" && stage !== "hired" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveStage(app, "rejected")}
                          >
                            Reject
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card title="Offers">
        <DataTable columns={offerCols} data={offers} />
      </Card>

      <Drawer
        isOpen={Boolean(selectedApp)}
        onClose={() => setSelectedApp(null)}
        title={selectedApp ? selectedApp.candidateName : "Application"}
      >
        {selectedApp && (
          <div className="space-y-4">
            {selectedApp.duplicateFlag && (
              <div className="p-3 bg-cream border-3 border-border text-xs">
                <strong>Duplicate candidate flagged:</strong> {selectedApp.duplicateReason}
              </div>
            )}

            <div className="text-sm space-y-1">
              <p><strong>Position:</strong> {selectedApp.positionTitle} ({selectedApp.requisitionNumber})</p>
              <p><strong>Email:</strong> {selectedApp.email}</p>
              <p><strong>Phone:</strong> {selectedApp.phoneMasked}</p>
              <p><strong>National ID:</strong> {selectedApp.nationalIdMasked}</p>
            </div>

            <div className="border-t-3 border-border pt-3">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2">Stage History</h3>
              <ul className="space-y-1 text-xs">
                {selectedApp.stageHistory.map((h, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="font-bold">{h.stage.replace("_", " ")}</span>
                    <span className="text-text-muted">{h.changedAt} · {h.by}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t-3 border-border pt-3 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider">Interview Scorecards</h3>
              {!selectedApp.currentUserSubmittedScorecard ? (
                <form onSubmit={handleSubmitScorecard} className="space-y-3 p-3 bg-page border-2 border-border">
                  <p className="text-xs text-text-muted">
                    Other panel members&apos; scores are hidden until you submit your scorecard.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold">Technical (1-5)</label>
                      <input type="number" min={1} max={5} value={techScore} onChange={(e) => setTechScore(Number(e.target.value))} className="w-full px-2 py-1 border-2 border-border bg-panel text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold">Comm (1-5)</label>
                      <input type="number" min={1} max={5} value={commScore} onChange={(e) => setCommScore(Number(e.target.value))} className="w-full px-2 py-1 border-2 border-border bg-panel text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold">Culture (1-5)</label>
                      <input type="number" min={1} max={5} value={cultScore} onChange={(e) => setCultScore(Number(e.target.value))} className="w-full px-2 py-1 border-2 border-border bg-panel text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold">Recommendation</label>
                    <select value={rec} onChange={(e) => setRec(e.target.value as "strong_hire" | "hire" | "no_hire")} className="w-full px-2 py-1 border-2 border-border bg-panel text-sm">
                      <option value="strong_hire">Strong Hire</option>
                      <option value="hire">Hire</option>
                      <option value="no_hire">No Hire</option>
                    </select>
                  </div>
                  <Button type="submit" size="sm" variant="lime">
                    Submit scorecard
                  </Button>
                </form>
              ) : (
                <div className="space-y-2">
                  {selectedApp.scorecards
                    .filter((s) => s.submitted)
                    .map((s) => (
                      <div key={s.id} className="p-2 bg-page border-2 border-border text-xs">
                        <div className="font-bold">{s.panelistName} — {s.recommendation}</div>
                        <div>Tech: {s.technicalScore}/5 · Comm: {s.communicationScore}/5 · Culture: {s.cultureScore}/5</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        isOpen={Boolean(selectedOffer)}
        onClose={() => setSelectedOffer(null)}
        title={selectedOffer ? `Offer: ${selectedOffer.candidateName}` : "Offer"}
      >
        {selectedOffer && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold">{selectedOffer.positionTitle} ({selectedOffer.grade})</span>
              <StatusChip
                status={mapHrmStatus(selectedOffer.status).status}
                label={mapHrmStatus(selectedOffer.status).label}
              />
            </div>

            <div>
              <StatusChip
                status={selectedOffer.bandStatus === "within_band" ? "good" : "watch"}
                label={selectedOffer.bandMessage}
              />
            </div>

            <div className="border-t-2 border-b-2 border-border py-2 space-y-1 text-sm">
              {selectedOffer.payLines.map((line, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{line.label}</span>
                  <span className="font-mono font-bold">{formatMoney(line.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold pt-2 border-t border-border">
                <span>Total Annual CTC</span>
                <span className="font-mono">{formatMoney(selectedOffer.totalAnnualCtc)}</span>
              </div>
            </div>

            <div className="text-xs text-text-muted space-y-1">
              <p>Joining Date: {selectedOffer.joiningDate}</p>
              <p>Expiry Date: {selectedOffer.expiryDate}</p>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-4">
              {selectedOffer.status === "approved" && (
                <Button
                  variant="lime"
                  onClick={() => setOfferAction({ offer: selectedOffer, type: "send" })}
                >
                  Send offer
                </Button>
              )}
              {selectedOffer.status === "sent" && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setOfferAction({ offer: selectedOffer, type: "withdraw" })}
                  >
                    Withdraw offer
                  </Button>
                  <Button
                    variant="lime"
                    disabled={selectedOffer.isExpired}
                    onClick={() => handleAcceptOffer(selectedOffer)}
                  >
                    Accept offer
                  </Button>
                </>
              )}
              {selectedOffer.isExpired && (
                <span className="text-xs font-bold text-act self-center">
                  Offer expired — acceptance disabled
                </span>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        isOpen={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Reject candidate"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Select a reason code to reject {rejectTarget?.candidateName ?? "candidate"}:
          </p>
          <select
            value={rejectReasonCode}
            onChange={(e) => setRejectReasonCode(e.target.value)}
            className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
          >
            {mockRejectionReasons.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} — {r.label}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button variant="lime" onClick={confirmReject}>
              Reject candidate
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(offerAction)}
        onClose={() => setOfferAction(null)}
        onConfirm={handleOfferConfirm}
        title={offerAction?.type === "send" ? "Send offer" : "Withdraw offer"}
        message={
          offerAction?.type === "send"
            ? `Send offer to ${offerAction.offer.candidateName}?`
            : `Withdraw offer for ${offerAction?.offer.candidateName}?`
        }
        actionVerb={offerAction?.type === "send" ? "Send offer" : "Withdraw offer"}
      />
    </div>
  );
};
