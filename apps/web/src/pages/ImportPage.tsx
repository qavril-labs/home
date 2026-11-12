import React, { useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { StatusChip } from "../components/ui/StatusChip";
import { DataTable, type Column } from "../components/ui/DataTable";
import { useToast } from "../context/ToastContext";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileText,
  Download,
} from "lucide-react";

interface ParsedRow {
  rowNum: number;
  col1: string;
  col2: string;
  col3: string;
  col4: string;
  isValid: boolean;
  validationError?: string;
}

export const ImportPage: React.FC = () => {
  const { showToast } = useToast();
  const [targetEntity, setTargetEntity] = useState<"contacts" | "items" | "journals">("contacts");
  const [selectedFile, setSelectedFile] = useState<string | null>("quickbooks_customers_export.csv");
  const [step, setStep] = useState<1 | 2 | 3>(2); // Default to mapping preview
  const [isImporting, setIsImporting] = useState(false);

  // Column mapping definitions
  const [mappings, setMappings] = useState<Record<string, string>>({
    "Company / Customer Name": "name",
    "Email Address": "email",
    "Primary Phone": "phone",
    "Current Open Balance": "balance",
  });

  const previewRows: ParsedRow[] = [
    {
      rowNum: 1,
      col1: "Apex Robotics Systems",
      col2: "procure@apexrobotics.com",
      col3: "+1 555-881-2091",
      col4: "1420.00",
      isValid: true,
    },
    {
      rowNum: 2,
      col1: "Titan Gear Works",
      col2: "ap@titangear.io",
      col3: "+1 555-772-9901",
      col4: "3890.50",
      isValid: true,
    },
    {
      rowNum: 3,
      col1: "Nordic CNC Solutions",
      col2: "billing@nordicnc.de",
      col3: "+49 89 201-992",
      col4: "0.00",
      isValid: true,
    },
    {
      rowNum: 4,
      col1: "MicroTech Dynamics",
      col2: "invalid-email-format",
      col3: "+1 555-220-1122",
      col4: "540.00",
      isValid: false,
      validationError: "Email format requires valid @domain syntax",
    },
    {
      rowNum: 5,
      col1: "Quantum Automations",
      col2: "finance@quantumauto.com",
      col3: "+1 555-661-8844",
      col4: "7200.00",
      isValid: true,
    },
  ];

  const columns: Column<ParsedRow>[] = [
    {
      header: "#",
      accessorKey: "rowNum",
      width: "60px",
      cell: (r) => <span className="font-mono text-xs font-bold text-muted">{r.rowNum}</span>,
    },
    {
      header: "Mapped: Business Name",
      accessorKey: "col1",
      cell: (r) => <span className="font-bold text-xs text-text">{r.col1}</span>,
    },
    {
      header: "Mapped: Email Address",
      accessorKey: "col2",
      cell: (r) => (
        <span
          className={`text-xs ${
            !r.isValid ? "text-act font-bold underline" : "text-text"
          }`}
        >
          {r.col2}
        </span>
      ),
    },
    {
      header: "Mapped: Phone Number",
      accessorKey: "col3",
      cell: (r) => <span className="text-xs text-muted font-mono">{r.col3}</span>,
    },
    {
      header: "Mapped: Balance (USD)",
      accessorKey: "col4",
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-xs text-series-in">
          ${r.col4}
        </span>
      ),
    },
    {
      header: "Validation Check",
      align: "center",
      cell: (r) =>
        r.isValid ? (
          <StatusChip status="good" label="Ready" />
        ) : (
          <StatusChip status="act" label="Invalid Field" />
        ),
    },
  ];

  const handleExecuteImport = () => {
    setIsImporting(true);
    setTimeout(() => {
      setIsImporting(false);
      showToast(
        "Import complete: 4 customer records imported, 1 flagged for review.",
        {
          type: "success",
        }
      );
      setStep(1);
      setSelectedFile(null);
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-pink block">
          Platform Foundation · PLT-14
        </span>
        <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-text leading-tight">
          CSV & Excel Import
        </h1>
        <p className="text-xs text-muted mt-1">
          Direct import and migration wizard for QuickBooks, Xero, Tally, and custom CSV spreadsheets.
        </p>
      </div>

      {/* Target Entity Selector */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "contacts", label: "Customers & Suppliers (MDM-01)" },
          { id: "items", label: "Items & Inventory (MDM-02)" },
          { id: "journals", label: "Opening Ledger Balances (FIN-01)" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTargetEntity(item.id as any)}
            className={`px-4 py-2 text-xs font-bold border-2 transition-all ${
              targetEntity === item.id
                ? "bg-lime text-ink border-ink shadow-[2px_2px_0_var(--q-ink)] -translate-y-0.5"
                : "bg-panel text-muted border-transparent hover:border-ink hover:text-text"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Step Progress indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          className={`p-3 border-line ${
            step >= 1 ? "bg-panel shadow-sm" : "bg-page opacity-60"
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-muted block">Step 1</span>
          <div className="font-bold text-sm text-text flex items-center justify-between mt-1">
            <span>Upload File</span>
            {selectedFile && <CheckCircle2 className="w-4 h-4 text-good" />}
          </div>
        </div>

        <div
          className={`p-3 border-line ${
            step >= 2 ? "bg-panel shadow-sm" : "bg-page opacity-60"
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-muted block">Step 2</span>
          <div className="font-bold text-sm text-text flex items-center justify-between mt-1">
            <span>Map Columns</span>
            {step >= 2 && <CheckCircle2 className="w-4 h-4 text-good" />}
          </div>
        </div>

        <div
          className={`p-3 border-line ${
            step === 3 ? "bg-lime text-ink shadow-sm" : "bg-panel"
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-muted block">Step 3</span>
          <div className="font-bold text-sm text-text flex items-center justify-between mt-1">
            <span>Verify & Import</span>
          </div>
        </div>
      </div>

      {/* Main Import Interface */}
      <div className="space-y-6">
        {/* Step 1: File dropzone */}
        {step === 1 && (
          <Card title="Upload CSV Spreadsheet">
            <div className="p-8 border-2 border-dashed border-ink bg-page text-center my-2">
              <UploadCloud className="w-12 h-12 mx-auto text-ink mb-3" />
              <h3 className="font-display font-bold text-base text-text uppercase">
                Drag and drop your CSV file here
              </h3>
              <p className="text-xs text-muted mt-1 mb-4">
                Supports UTF-8 formatted .csv files up to 10MB.
              </p>
              <Button
                variant="lime"
                size="md"
                onClick={() => {
                  setSelectedFile("quickbooks_customers_export.csv");
                  setStep(2);
                  showToast("File loaded: quickbooks_customers_export.csv", { type: "info" });
                }}
              >
                Choose File from Computer
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2 & 3: Mapping and Preview */}
        {step >= 2 && (
          <>
            <Card
              title="Column Mapping Configuration"
              subtitle={`Matching columns from ${selectedFile} into QAVRIL LABS schema`}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep(1);
                    setSelectedFile(null);
                  }}
                >
                  Change file
                </Button>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(mappings).map(([sourceCol, targetField]) => (
                  <div key={sourceCol} className="p-3 bg-page border-line">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                      CSV Header
                    </span>
                    <div className="font-bold text-xs text-text my-1 truncate">
                      {sourceCol}
                    </div>
                    <ArrowRight className="w-3 h-3 text-pink my-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-good block">
                      Target ERP Field
                    </span>
                    <select
                      value={targetField}
                      onChange={(e) =>
                        setMappings((prev) => ({ ...prev, [sourceCol]: e.target.value }))
                      }
                      className="w-full mt-1 px-2 py-1 text-xs font-bold bg-panel border-line"
                    >
                      <option value="name">Party Name</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="balance">Opening Balance</option>
                      <option value="city">City</option>
                      <option value="taxId">Tax Identification</option>
                      <option value="ignore">-- Skip / Ignore --</option>
                    </select>
                  </div>
                ))}
              </div>
            </Card>

            {/* Validation Preview Table */}
            <Card
              title="Data Validation Preview"
              subtitle="5 rows scanned: 4 valid, 1 error requiring correction"
              action={
                <div className="flex items-center gap-2">
                  <Button
                    variant="lime"
                    size="md"
                    disabled={isImporting}
                    onClick={handleExecuteImport}
                  >
                    {isImporting ? "Importing records…" : "Proceed with Import (4 rows)"}
                  </Button>
                </div>
              }
              featured
            >
              <DataTable columns={columns} data={previewRows} />
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
