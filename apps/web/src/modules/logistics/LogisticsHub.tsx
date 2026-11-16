import React, { useState } from "react";
import { Button } from "../../components/ui/Button";
import { StatusChip } from "../../components/ui/StatusChip";
import { Modal } from "../../components/ui/Modal";
import { FleetMap3D } from "../../scenes/FleetMap3D";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import { eventBus } from "../../lib/event-stream";
import { sound } from "../../lib/sound-effects";
import {
  initialMockConsignments,
  initialMockVehicles,
  initialMockCarrierRates,
} from "../../lib/api-mock";
import type { ConsignmentShipment, FleetVehicle, CarrierRateQuote } from "../../types";
import {
  CheckCircle2,
  Compass,
  FileCheck,
  ShieldCheck,
  Flame,
} from "lucide-react";

export const LogisticsHub: React.FC = () => {
  const { showToast } = useToast();
  const [consignments, setConsignments] = useState<ConsignmentShipment[]>(initialMockConsignments);
  const [vehicles] = useState<FleetVehicle[]>(initialMockVehicles);
  const [carrierRates] = useState<CarrierRateQuote[]>(initialMockCarrierRates);
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [selectedConsignment, setSelectedConsignment] = useState<ConsignmentShipment | null>(null);
  const [isPodModalOpen, setIsPodModalOpen] = useState<boolean>(false);
  const [signerName, setSignerName] = useState<string>("J. Miller (Receiving Lead)");

  const handleOpenPod = (c: ConsignmentShipment) => {
    setSelectedConsignment(c);
    setIsPodModalOpen(true);
  };

  const handleConfirmPod = () => {
    if (!selectedConsignment) return;

    sound.playSuccessChime();

    const signedAt = new Date().toISOString();
    const mockHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    // Emit consignment.delivered domain event
    eventBus.emit({
      type: "consignment.delivered",
      producer: "services/uaap/logistics_fleet",
      data: {
        trackingNumber: selectedConsignment.trackingNumber,
        destination: selectedConsignment.destinationCity,
        signedBy: signerName,
        signatureHash: mockHash,
      },
    });

    setConsignments((prev) =>
      prev.map((c) =>
        c.id === selectedConsignment.id
          ? {
              ...c,
              status: "delivered",
              proofOfDelivery: {
                signedBy: signerName,
                signedAt,
                signatureHash: mockHash,
              },
            }
          : c
      )
    );

    setIsPodModalOpen(false);
    showToast(
      `Proof of Delivery verified for ${selectedConsignment.trackingNumber} · Signed by ${signerName}`,
      undefined,
      "good"
    );
  };

  return (
    <div className="space-y-6" data-testid="logistics-hub">
      {/* Title & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pink block">
            Supply Chain & Fulfillment · LOG-01 / LOG-04
          </span>
          <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-text leading-tight">
            Logistics, Shipping & Fleet Telemetry
          </h1>
          <p className="text-xs text-muted mt-1 max-w-2xl">
            Live freight tracking with 3D transit arcs, carrier rate comparison, and cryptographic Proof-of-Delivery sign-off.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border-line bg-panel p-0.5">
            <button
              type="button"
              data-testid="toggle-3d-map"
              onClick={() => {
                setViewMode("3d");
                sound.playClick();
              }}
              className={`px-3 py-1.5 text-xs font-bold font-mono transition-all cursor-pointer ${
                viewMode === "3d" ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]" : "text-muted hover:text-text"
              }`}
            >
              3D Fleet Map
            </button>
            <button
              type="button"
              data-testid="toggle-2d-table"
              onClick={() => {
                setViewMode("2d");
                sound.playClick();
              }}
              className={`px-3 py-1.5 text-xs font-bold font-mono transition-all cursor-pointer ${
                viewMode === "2d" ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]" : "text-muted hover:text-text"
              }`}
            >
              2D Schedule
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="neo-card p-3 bg-panel" data-testid="stat-active-shipments">
          <span className="text-[10px] font-bold uppercase text-muted block">Active Freight</span>
          <div className="font-display font-black text-2xl text-text mt-1">
            {consignments.filter((c) => c.status !== "delivered").length} In Transit
          </div>
          <span className="text-[10px] text-muted">Across 3 carriers</span>
        </div>

        <div className="neo-card p-3 bg-panel">
          <span className="text-[10px] font-bold uppercase text-muted block">On-Time Reliability</span>
          <div className="font-display font-black text-2xl text-good mt-1">99.4%</div>
          <span className="text-[10px] text-muted">SLA target: 98.0%</span>
        </div>

        <div className="neo-card p-3 bg-panel">
          <span className="text-[10px] font-bold uppercase text-muted block">Cargo Value in Motion</span>
          <div className="font-display font-black text-xl text-text mt-1">$26,860.00</div>
          <span className="text-[10px] text-muted">Insured goods in transit</span>
        </div>

        <div className="neo-card p-3 bg-panel">
          <span className="text-[10px] font-bold uppercase text-muted block">Carbon Footprint</span>
          <div className="font-display font-black text-xl text-text mt-1 flex items-center gap-1">
            <Flame className="w-4 h-4 text-orange" />
            <span>96.7 kg CO₂</span>
          </div>
          <span className="text-[10px] text-muted">Optimized route routing</span>
        </div>
      </div>

      {/* Hero 3D Fleet Map or 2D Alternative */}
      {viewMode === "3d" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-muted px-1">
            <span className="flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-cyan" />
              <span>Interactive 3D Freight Map (Tilted Geographic Coordinate Grid)</span>
            </span>
            <span className="font-mono text-[11px] text-text">Click arc peak to inspect</span>
          </div>
          <FleetMap3D
            consignments={consignments}
            vehicles={vehicles}
            onSelectConsignment={handleOpenPod}
          />
        </div>
      ) : null}

      {/* Consignment Shipments Table */}
      <div className="neo-card p-5 bg-panel space-y-3" data-testid="consignments-table">
        <div className="flex items-center justify-between pb-2 border-b border-grid">
          <h2 className="font-display font-black text-base uppercase tracking-tight">
            Active Consignments & Dispatches
          </h2>
          <span className="text-xs font-mono font-bold text-muted bg-page px-2 py-0.5 border-line">
            LOG-04 Telemetry
          </span>
        </div>

        <div className="overflow-x-auto border-line bg-page">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-ink bg-panel text-[10px] font-bold uppercase text-muted">
                <th className="py-2 px-3">Tracking #</th>
                <th className="py-2 px-3">Carrier</th>
                <th className="py-2 px-3">Route</th>
                <th className="py-2 px-3 text-right">Value</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">ETA</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid font-sans">
              {consignments.map((c) => (
                <tr key={c.id} data-testid={`consignment-row-${c.id}`} className="hover:bg-panel transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold">{c.trackingNumber}</td>
                  <td className="py-2.5 px-3 font-medium">{c.carrier}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-bold">{c.originCity}</span> → <span>{c.destinationCity}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">{formatMoney(c.value)}</td>
                  <td className="py-2.5 px-3">
                    <StatusChip
                      status={
                        c.status === "delivered" ? "good" : c.status === "out_for_delivery" ? "watch" : "act"
                      }
                      label={c.status.replace(/_/g, " ").toUpperCase()}
                    />
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-muted">{c.eta}</td>
                  <td className="py-2.5 px-3 text-right">
                    {c.status !== "delivered" ? (
                      <Button
                        variant="lime"
                        size="sm"
                        data-testid={`pod-btn-${c.id}`}
                        onClick={() => handleOpenPod(c)}
                      >
                        <FileCheck className="w-3.5 h-3.5 mr-1" />
                        Verify POD
                      </Button>
                    ) : (
                      <span className="text-[11px] font-mono text-good font-bold flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Signed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Carrier Rate Comparison Matrix (LOG-01) */}
      <div className="neo-card p-5 bg-panel space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-grid">
          <div>
            <h3 className="font-display font-black text-sm uppercase">
              Carrier Rate Optimization (LOG-01)
            </h3>
            <p className="text-xs text-muted">
              Live quote comparison for outbound freight dispatch.
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold text-good">AI Route Optimized</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {carrierRates.map((rate, i) => (
            <div
              key={i}
              className={`p-3 bg-page border-line space-y-2 ${
                rate.isRecommended ? "border-2 border-lime shadow-[3px_3px_0_var(--q-ink)]" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">{rate.carrier}</span>
                {rate.isRecommended && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-lime text-ink font-mono uppercase">
                    Best Value
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted">{rate.serviceLevel}</div>
              <div className="flex justify-between items-baseline pt-2 border-t border-grid text-xs">
                <span className="text-muted">{rate.transitDays} Day Transit</span>
                <span className="font-display font-black text-base text-text">
                  {formatMoney(rate.cost)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Proof-of-Delivery (POD) Sign-Off Modal */}
      {selectedConsignment && (
        <Modal
          isOpen={isPodModalOpen}
          onClose={() => setIsPodModalOpen(false)}
          title={`Proof of Delivery Sign-Off · ${selectedConsignment.trackingNumber}`}
          description={`Destination: ${selectedConsignment.destinationCity} · Consignment Value: ${formatMoney(selectedConsignment.value)}`}
          primaryActionLabel="Authorize Delivery & Post POD"
          primaryActionVariant="lime"
          onPrimaryAction={handleConfirmPod}
          secondaryActionLabel="Cancel"
          onSecondaryAction={() => setIsPodModalOpen(false)}
        >
          <div className="space-y-4 text-xs" data-testid="pod-modal">
            <div className="p-3 bg-page border-line space-y-1">
              <span className="text-[10px] font-bold uppercase text-muted block">
                Consignment Details:
              </span>
              <p className="font-mono text-text">
                Carrier: <strong>{selectedConsignment.carrier}</strong> · Driver: {selectedConsignment.driverName}
              </p>
              <p className="font-mono text-muted text-[11px]">
                Origin: {selectedConsignment.originCity} → Destination: {selectedConsignment.destinationCity}
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted block">
                Receiver Signer Name & Title:
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="w-full p-2 bg-panel border-line font-mono text-xs focus:ring-2 focus:ring-lime"
              />
            </div>

            <div className="p-3 bg-panel border-line flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-good shrink-0" />
              <span className="text-[11px] text-muted">
                Generates SHA-256 cryptographic proof of delivery and auto-posts status update to general ledger.
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
