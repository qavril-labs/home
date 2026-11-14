import React, { useState, useMemo } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { StatusChip } from "../components/ui/StatusChip";
import { DataTable, type Column } from "../components/ui/DataTable";
import { useToast } from "../context/ToastContext";
import { formatMoney } from "../lib/currency";
import {
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  Download,
  AlertCircle,
  FileSpreadsheet,
  RotateCw,
} from "lucide-react";

export type TargetEntity = "contacts" | "items" | "accounts" | "journals";
export type SourcePlatform = "quickbooks" | "xero" | "tally" | "generic";

interface ParsedRow {
  rowNum: number;
  col1: string;
  col2: string;
  col3: string;
  col4: string;
  col5?: string;
  isValid: boolean;
  validationError?: string;
}

interface EntityConfig {
  id: TargetEntity;
  label: string;
  sublabel: string;
  code: string;
  targetFields: { key: string; label: string; required?: boolean }[];
  defaultMappings: Record<SourcePlatform, Record<string, string>>;
  sampleRows: Record<SourcePlatform, ParsedRow[]>;
  csvTemplate: string;
}

const ENTITY_CONFIGS: Record<TargetEntity, EntityConfig> = {
  contacts: {
    id: "contacts",
    label: "Customers & Suppliers",
    sublabel: "Master party directory with tax IDs & terms",
    code: "MDM-01",
    targetFields: [
      { key: "legalName", label: "Legal Company Name", required: true },
      { key: "email", label: "Primary Email", required: true },
      { key: "taxId", label: "Tax Registration / VAT ID" },
      { key: "paymentTerms", label: "Payment Terms (e.g. Net 30)" },
      { key: "balance", label: "Opening Outstanding Balance" },
    ],
    defaultMappings: {
      quickbooks: {
        "Customer / Company Name": "legalName",
        "Primary Email": "email",
        "Tax ID": "taxId",
        "Terms": "paymentTerms",
        "Open Balance": "balance",
      },
      xero: {
        "Contact Name": "legalName",
        "Email Address": "email",
        "Tax Number": "taxId",
        "Default Terms": "paymentTerms",
        "Outstanding Amount": "balance",
      },
      tally: {
        "Ledger Name": "legalName",
        "Email": "email",
        "GSTIN / UIN": "taxId",
        "Credit Period": "paymentTerms",
        "Closing Balance": "balance",
      },
      generic: {
        "Company Name": "legalName",
        "Email": "email",
        "Tax ID": "taxId",
        "Terms": "paymentTerms",
        "Balance": "balance",
      },
    },
    sampleRows: {
      quickbooks: [
        { rowNum: 1, col1: "Apex Robotics Systems", col2: "procure@apexrobotics.com", col3: "US-8829102", col4: "Net 30", col5: "1420.00", isValid: true },
        { rowNum: 2, col1: "Titan Gear Works Inc", col2: "ap@titangear.io", col3: "US-9910291", col4: "Net 60", col5: "3890.50", isValid: true },
        { rowNum: 3, col1: "Nordic CNC Solutions GmbH", col2: "billing@nordicnc.de", col3: "DE-3029182", col4: "Net 30", col5: "0.00", isValid: true },
        { rowNum: 4, col1: "MicroTech Dynamics", col2: "invalid-email-syntax", col3: "US-7718291", col4: "Net 30", col5: "540.00", isValid: false, validationError: "Invalid email syntax: missing '@' domain structure." },
        { rowNum: 5, col1: "Quantum Automations Corp", col2: "finance@quantumauto.com", col3: "US-4401928", col4: "Net 30", col5: "7200.00", isValid: true },
      ],
      xero: [
        { rowNum: 1, col1: "Pacific Rim Logistics", col2: "freight@pacificrim.com", col3: "AU-1029384", col4: "Net 30", col5: "5200.00", isValid: true },
        { rowNum: 2, col1: "Zephyr Clean Energy", col2: "zephyr-invalid-address", col3: "AU-9988221", col4: "Net 15", col5: "1280.00", isValid: false, validationError: "Invalid email format." },
        { rowNum: 3, col1: "Global Foundry Works", col2: "ap@globalfoundry.com", col3: "AU-4433221", col4: "Net 60", col5: "14500.00", isValid: true },
      ],
      tally: [
        { rowNum: 1, col1: "Bharat Industrial Spares", col2: "sales@bharatspares.in", col3: "27AABCU9603R1ZM", col4: "Net 30", col5: "9850.00", isValid: true },
        { rowNum: 2, col1: "Delta Precision Tools", col2: "accounts@deltaprecision.in", col3: "29AAGCB2201Q1Z8", col4: "Net 45", col5: "3200.00", isValid: true },
      ],
      generic: [
        { rowNum: 1, col1: "Enterprise Components LLC", col2: "contact@enterprise.com", col3: "TAX-1029", col4: "Net 30", col5: "2500.00", isValid: true },
      ],
    },
    csvTemplate: `Company Name,Email,Tax ID,Terms,Balance\nAcme Corporation,billing@acme.com,US-9928101,Net 30,1500.00\nStark Industries,ap@stark.com,US-1029384,Net 60,8450.00\nWayne Enterprises,finance@wayne.com,US-7788112,Net 30,0.00\n`,
  },
  items: {
    id: "items",
    label: "Items & Inventory",
    sublabel: "Products, raw materials, SKUs & stock valuations",
    code: "MDM-02",
    targetFields: [
      { key: "code", label: "Item SKU / Code", required: true },
      { key: "name", label: "Item Description / Name", required: true },
      { key: "category", label: "Category (Product/Raw/Assembly)" },
      { key: "uom", label: "Unit of Measure (UOM)" },
      { key: "salePrice", label: "Standard Sale Price" },
    ],
    defaultMappings: {
      quickbooks: {
        "Item Name / Number": "code",
        "Description": "name",
        "Type": "category",
        "U/M": "uom",
        "Sales Price": "salePrice",
      },
      xero: {
        "Item Code": "code",
        "Item Name": "name",
        "Inventory Asset Account": "category",
        "Unit": "uom",
        "Unit Price": "salePrice",
      },
      tally: {
        "Stock Item Name": "code",
        "Description": "name",
        "Stock Group": "category",
        "Base Units": "uom",
        "Standard Rate": "salePrice",
      },
      generic: {
        "SKU": "code",
        "Name": "name",
        "Category": "category",
        "Unit": "uom",
        "Price": "salePrice",
      },
    },
    sampleRows: {
      quickbooks: [
        { rowNum: 1, col1: "SKU-TITAN-100", col2: "Precision CNC Gear Shaft 12mm", col3: "Raw Material", col4: "PCS", col5: "145.00", isValid: true },
        { rowNum: 2, col1: "SKU-BEAR-404", col2: "High-Temp Ceramic Bearing", col3: "Subassembly", col4: "PCS", col5: "88.50", isValid: true },
        { rowNum: 3, col1: "SKU-HYDR-002", col2: "Pressure Relief Actuator Valve", col3: "Finished Good", col4: "PCS", col5: "450.00", isValid: true },
        { rowNum: 4, col1: "", col2: "Missing SKU Hardware Bolt", col3: "Hardware", col4: "BOX", col5: "12.00", isValid: false, validationError: "Item SKU / Code is required." },
        { rowNum: 5, col1: "SKU-SEAL-88", col2: "Nitrile O-Ring Seal Kit 50pc", col3: "Consumable", col4: "SET", col5: "34.00", isValid: true },
      ],
      xero: [
        { rowNum: 1, col1: "PROD-A1", col2: "Standard Bracket Mount", col3: "Finished", col4: "EA", col5: "45.00", isValid: true },
      ],
      tally: [
        { rowNum: 1, col1: "IND-STEEL-01", col2: "Grade 316 Stainless Plate", col3: "Raw", col4: "KG", col5: "220.00", isValid: true },
      ],
      generic: [
        { rowNum: 1, col1: "GEN-001", col2: "General Fastener", col3: "General", col4: "PCS", col5: "5.00", isValid: true },
      ],
    },
    csvTemplate: `SKU,Name,Category,Unit,Price\nSKU-1001,High Torque Servo Motor,Components,PCS,250.00\nSKU-1002,Alloy Mounting Plate,Hardware,PCS,45.00\nSKU-1003,Braided Wiring Harness,Cables,SET,78.50\n`,
  },
  accounts: {
    id: "accounts",
    label: "Chart of Accounts",
    sublabel: "5-category standard ledger taxonomy (Assets to Expenses)",
    code: "MDM-03",
    targetFields: [
      { key: "code", label: "Account Code", required: true },
      { key: "name", label: "Account Name", required: true },
      { key: "type", label: "Classification (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE)", required: true },
      { key: "currency", label: "Currency (e.g. USD)" },
      { key: "balance", label: "Opening Balance" },
    ],
    defaultMappings: {
      quickbooks: {
        "Account #": "code",
        "Account Name": "name",
        "Account Type": "type",
        "Currency": "currency",
        "Balance": "balance",
      },
      xero: {
        "Account Code": "code",
        "Account Name": "name",
        "Type": "type",
        "Currency Code": "currency",
        "YTD Balance": "balance",
      },
      tally: {
        "Ledger Code": "code",
        "Ledger Name": "name",
        "Under Primary Group": "type",
        "Currency": "currency",
        "Opening Balance": "balance",
      },
      generic: {
        "Code": "code",
        "Name": "name",
        "Classification": "type",
        "Currency": "currency",
        "Balance": "balance",
      },
    },
    sampleRows: {
      quickbooks: [
        { rowNum: 1, col1: "1010", col2: "Operating Checking Account", col3: "ASSET", col4: "USD", col5: "142500.00", isValid: true },
        { rowNum: 2, col1: "1200", col2: "Accounts Receivable Trade", col3: "ASSET", col4: "USD", col5: "84200.00", isValid: true },
        { rowNum: 3, col1: "2010", col2: "Accounts Payable Trade", col3: "LIABILITY", col4: "USD", col5: "48200.00", isValid: true },
        { rowNum: 4, col1: "9999", col2: "Unclassified Clearing", col3: "OTHER_UNKNOWN", col4: "USD", col5: "0.00", isValid: false, validationError: "Invalid classification: must map to ASSET, LIABILITY, EQUITY, REVENUE, or EXPENSE." },
        { rowNum: 5, col1: "4010", col2: "Robotics System Sales", col3: "REVENUE", col4: "USD", col5: "354000.00", isValid: true },
      ],
      xero: [
        { rowNum: 1, col1: "090", col2: "Business Bank Account", col3: "ASSET", col4: "USD", col5: "50000.00", isValid: true },
      ],
      tally: [
        { rowNum: 1, col1: "BANK-01", col2: "HDFC Primary Current", col3: "ASSET", col4: "INR", col5: "2500000.00", isValid: true },
      ],
      generic: [
        { rowNum: 1, col1: "1000", col2: "Cash on Hand", col3: "ASSET", col4: "USD", col5: "1200.00", isValid: true },
      ],
    },
    csvTemplate: `Code,Name,Classification,Currency,Balance\n1010,Operating Cash Account,ASSET,USD,125000.00\n1200,Accounts Receivable,ASSET,USD,45000.00\n2010,Accounts Payable,LIABILITY,USD,32000.00\n3010,Common Stock,EQUITY,USD,100000.00\n4010,Commercial Revenue,REVENUE,USD,250000.00\n5010,Cost of Goods Sold,EXPENSE,USD,112000.00\n`,
  },
  journals: {
    id: "journals",
    label: "Opening Balances / Journals",
    sublabel: "Double-entry opening trial balance import with debit/credit parity",
    code: "FIN-01",
    targetFields: [
      { key: "accountCode", label: "Account Code", required: true },
      { key: "accountName", label: "Account Title" },
      { key: "debit", label: "Debit Amount (USD)", required: true },
      { key: "credit", label: "Credit Amount (USD)", required: true },
      { key: "memo", label: "Journal Memo / Line Description" },
    ],
    defaultMappings: {
      quickbooks: {
        "Account #": "accountCode",
        "Account": "accountName",
        "Debit": "debit",
        "Credit": "credit",
        "Description": "memo",
      },
      xero: {
        "AccountCode": "accountCode",
        "AccountName": "accountName",
        "Debit": "debit",
        "Credit": "credit",
        "Narration": "memo",
      },
      tally: {
        "Ledger Code": "accountCode",
        "Particulars": "accountName",
        "Debit Amount": "debit",
        "Credit Amount": "credit",
        "Narration": "memo",
      },
      generic: {
        "Account Code": "accountCode",
        "Account Name": "accountName",
        "Debit": "debit",
        "Credit": "credit",
        "Memo": "memo",
      },
    },
    sampleRows: {
      quickbooks: [
        { rowNum: 1, col1: "1010", col2: "Operating Cash", col3: "142500.00", col4: "0.00", col5: "Opening cash in checking", isValid: true },
        { rowNum: 2, col1: "1200", col2: "Accounts Receivable", col3: "84200.00", col4: "0.00", col5: "Subledger AR balance", isValid: true },
        { rowNum: 3, col1: "2010", col2: "Accounts Payable", col3: "0.00", col4: "48200.00", col5: "Subledger AP balance", isValid: true },
        { rowNum: 4, col1: "3010", col2: "Owner Capital / Equity", col3: "0.00", col4: "178500.00", col5: "Retained equity opening", isValid: true },
      ],
      xero: [
        { rowNum: 1, col1: "090", col2: "Bank Account", col3: "50000.00", col4: "0.00", col5: "Xero trial balance", isValid: true },
      ],
      tally: [
        { rowNum: 1, col1: "BANK-01", col2: "Bank Balance", col3: "25000.00", col4: "0.00", col5: "Tally opening balance", isValid: true },
      ],
      generic: [
        { rowNum: 1, col1: "1000", col2: "Operating Cash", col3: "10000.00", col4: "0.00", col5: "Opening cash balance", isValid: true },
      ],
    },
    csvTemplate: `Account Code,Account Name,Debit,Credit,Memo\n1010,Cash & Equivalents,100000.00,0.00,Opening Cash\n1200,Accounts Receivable,45000.00,0.00,Opening Debtors\n2010,Accounts Payable,0.00,35000.00,Opening Creditors\n3010,Owner Equity,0.00,110000.00,Initial Equity\n`,
  },
};

export const ImportPage: React.FC = () => {
  const { showToast } = useToast();

  const [targetEntity, setTargetEntity] = useState<TargetEntity>("contacts");
  const [sourcePlatform, setSourcePlatform] = useState<SourcePlatform>("quickbooks");
  const [selectedFile, setSelectedFile] = useState<string | null>("quickbooks_customers_export.csv");
  const [step, setStep] = useState<1 | 2 | 3>(2); // Default to mapping & preview
  const [isImporting, setIsImporting] = useState(false);
  const [importCompleted, setImportCompleted] = useState(false);

  const currentConfig = ENTITY_CONFIGS[targetEntity];

  // Column mappings
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    return { ...ENTITY_CONFIGS.contacts.defaultMappings.quickbooks };
  });

  // Switch entity handler
  const handleSelectEntity = (entity: TargetEntity) => {
    setTargetEntity(entity);
    const cfg = ENTITY_CONFIGS[entity];
    setMappings({ ...cfg.defaultMappings[sourcePlatform] });
    setSelectedFile(`${sourcePlatform}_${entity}_export.csv`);
    setStep(2);
    setImportCompleted(false);
  };

  // Switch source platform handler
  const handleSelectSource = (platform: SourcePlatform) => {
    setSourcePlatform(platform);
    const cfg = ENTITY_CONFIGS[targetEntity];
    setMappings({ ...cfg.defaultMappings[platform] });
    setSelectedFile(`${platform}_${targetEntity}_export.csv`);
    showToast(`Loaded ${platform.toUpperCase()} preset mapping for ${cfg.label}`, { type: "info" });
  };

  // Download template CSV handler
  const handleDownloadTemplate = () => {
    const csvContent = currentConfig.csvTemplate;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `qavril_${targetEntity}_template_${sourcePlatform}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Template downloaded: qavril_${targetEntity}_template_${sourcePlatform}.csv`, {
      type: "success",
    });
  };

  const previewRows = useMemo(() => {
    return currentConfig.sampleRows[sourcePlatform] || currentConfig.sampleRows.quickbooks;
  }, [currentConfig, sourcePlatform]);

  const validRowsCount = useMemo(() => {
    return previewRows.filter((r) => r.isValid).length;
  }, [previewRows]);

  const invalidRowsCount = useMemo(() => {
    return previewRows.filter((r) => !r.isValid).length;
  }, [previewRows]);

  // Dynamic table columns based on entity config
  const columns = useMemo<Column<ParsedRow>[]>(() => {
    const baseCols: Column<ParsedRow>[] = [
      {
        header: "#",
        accessorKey: "rowNum",
        width: "55px",
        cell: (r) => <span className="font-mono text-xs font-bold text-muted">{r.rowNum}</span>,
      },
      {
        header: `Mapped: ${currentConfig.targetFields[0]?.label || "Col 1"}`,
        accessorKey: "col1",
        cell: (r) => <span className="font-bold text-xs text-text">{r.col1 || "—"}</span>,
      },
      {
        header: `Mapped: ${currentConfig.targetFields[1]?.label || "Col 2"}`,
        accessorKey: "col2",
        cell: (r) => (
          <span
            className={`text-xs ${
              !r.isValid && r.validationError ? "text-act font-bold underline" : "text-text"
            }`}
          >
            {r.col2 || "—"}
          </span>
        ),
      },
      {
        header: `Mapped: ${currentConfig.targetFields[2]?.label || "Col 3"}`,
        accessorKey: "col3",
        cell: (r) => <span className="text-xs font-mono text-muted">{r.col3 || "—"}</span>,
      },
      {
        header: `Mapped: ${currentConfig.targetFields[3]?.label || "Col 4"}`,
        accessorKey: "col4",
        cell: (r) => <span className="text-xs font-mono text-muted">{r.col4 || "—"}</span>,
      },
    ];

    if (currentConfig.targetFields[4]) {
      baseCols.push({
        header: `Mapped: ${currentConfig.targetFields[4].label}`,
        accessorKey: "col5",
        align: "right",
        cell: (r) => {
          if (!r.col5) return <span className="text-xs text-muted">—</span>;
          const isNumeric = !isNaN(Number(r.col5));
          return (
            <span className="font-mono font-bold text-xs text-series-in">
              {isNumeric ? formatMoney(r.col5) : r.col5}
            </span>
          );
        },
      });
    }

    baseCols.push({
      header: "Validation Status",
      align: "center",
      cell: (r) =>
        r.isValid ? (
          <StatusChip status="good" label="Ready" />
        ) : (
          <div className="flex items-center gap-1">
            <StatusChip status="act" label="Quarantine" />
            <span className="text-[10px] text-act font-bold" title={r.validationError}>
              (! Error)
            </span>
          </div>
        ),
    });

    return baseCols;
  }, [currentConfig]);

  const handleExecuteImport = () => {
    setIsImporting(true);
    setTimeout(() => {
      setIsImporting(false);
      setImportCompleted(true);
      showToast(
        `Import complete: ${validRowsCount} ${currentConfig.label} records migrated successfully. ${
          invalidRowsCount > 0 ? `${invalidRowsCount} flagged for review.` : ""
        }`,
        {
          type: "success",
        }
      );
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-grid">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-pink">
              Platform Foundation · PLT-14
            </span>
            <span className="px-1.5 py-0.5 bg-page border border-grid text-[10px] font-mono text-muted">
              MIGRATION ENGINE
            </span>
          </div>
          <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-text leading-tight">
            CSV & Migration Import
          </h1>
          <p className="text-xs text-muted mt-1 max-w-3xl">
            Automated schema mapping and legacy ERP onboarding engine for QuickBooks Online, Xero, Tally Prime, and standard CSV spreadsheets with automatic row-level schema validation.
          </p>
        </div>

        {/* Download Template Action */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-good" />
            <span>Download CSV Template</span>
          </Button>
        </div>
      </div>

      {/* Target Master Data Entity Tabs */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(ENTITY_CONFIGS) as TargetEntity[]).map((key) => {
          const cfg = ENTITY_CONFIGS[key];
          const isSelected = targetEntity === key;
          return (
            <button
              key={cfg.id}
              onClick={() => handleSelectEntity(key)}
              className={`px-4 py-2 text-xs font-bold border-2 transition-all flex items-center gap-2 ${
                isSelected
                  ? "bg-lime text-ink border-ink shadow-[2px_2px_0_var(--q-ink)] -translate-y-0.5"
                  : "bg-panel text-muted border-transparent hover:border-ink hover:text-text"
              }`}
            >
              <span>{cfg.label}</span>
              <span className="text-[10px] opacity-75 font-mono">({cfg.code})</span>
            </button>
          );
        })}
      </div>

      {/* Migration Source Platform Selector */}
      <div className="p-3 bg-panel border-line shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-cyan" />
          <span className="text-xs font-bold uppercase text-text">Preset Platform Schema:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "quickbooks", label: "QuickBooks Online" },
              { id: "xero", label: "Xero" },
              { id: "tally", label: "Tally Prime" },
              { id: "generic", label: "Custom / Generic CSV" },
            ] as const
          ).map((src) => (
            <button
              key={src.id}
              onClick={() => handleSelectSource(src.id)}
              className={`px-3 py-1 text-xs font-bold border transition-all ${
                sourcePlatform === src.id
                  ? "bg-yellow text-ink border-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted border-grid hover:text-text"
              }`}
            >
              {src.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step Progress Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          onClick={() => {
            setStep(1);
            setImportCompleted(false);
          }}
          className={`p-3 border-line cursor-pointer transition-all ${
            step === 1 ? "bg-yellow text-ink shadow-card" : "bg-panel shadow-sm"
          }`}
        >
          <span className="text-[10px] font-bold uppercase block opacity-75">Step 1</span>
          <div className="font-bold text-sm flex items-center justify-between mt-1">
            <span>1. Upload File</span>
            {selectedFile && <CheckCircle2 className="w-4 h-4 text-good" />}
          </div>
          <span className="text-[11px] block mt-1 truncate opacity-75">
            {selectedFile || "Select CSV file"}
          </span>
        </div>

        <div
          onClick={() => {
            setStep(2);
            setImportCompleted(false);
          }}
          className={`p-3 border-line cursor-pointer transition-all ${
            step === 2 && !importCompleted
              ? "bg-yellow text-ink shadow-card"
              : "bg-panel shadow-sm"
          }`}
        >
          <span className="text-[10px] font-bold uppercase block opacity-75">Step 2</span>
          <div className="font-bold text-sm flex items-center justify-between mt-1">
            <span>2. Column Mapping</span>
            {step >= 2 && <CheckCircle2 className="w-4 h-4 text-good" />}
          </div>
          <span className="text-[11px] block mt-1 opacity-75">
            {Object.keys(mappings).length} columns mapped
          </span>
        </div>

        <div
          onClick={() => setStep(3)}
          className={`p-3 border-line cursor-pointer transition-all ${
            step === 3 || importCompleted
              ? "bg-lime text-ink shadow-card"
              : "bg-panel shadow-sm"
          }`}
        >
          <span className="text-[10px] font-bold uppercase block opacity-75">Step 3</span>
          <div className="font-bold text-sm flex items-center justify-between mt-1">
            <span>3. Review & Ingest</span>
            {importCompleted && <CheckCircle2 className="w-4 h-4 text-ink" />}
          </div>
          <span className="text-[11px] block mt-1 opacity-75">
            {validRowsCount} valid / {invalidRowsCount} flagged
          </span>
        </div>
      </div>

      {/* Import Completed Success Banner */}
      {importCompleted && (
        <div className="p-6 bg-lime text-ink border-line shadow-card space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-ink" />
                <h3 className="font-display font-extrabold text-xl uppercase tracking-tight">
                  Migration Ingestion Completed Successfully
                </h3>
              </div>
              <p className="text-xs font-bold leading-normal max-w-2xl">
                {validRowsCount} {currentConfig.label} records have been committed to the QAVRIL LABS ledger memory and master data store.
                {invalidRowsCount > 0 && (
                  <span className="block mt-1 text-ink/80">
                    {invalidRowsCount} row(s) were quarantined for schema correction.
                  </span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setImportCompleted(false);
                setStep(2);
              }}
              className="bg-panel text-text hover:bg-page"
            >
              <RotateCw className="w-4 h-4 mr-1.5" />
              <span>Import Another File</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Wizard Content */}
      <div className="space-y-6">
        {/* Step 1: File Dropzone */}
        {step === 1 && (
          <Card
            title={`Upload ${currentConfig.label} Spreadsheet`}
            subtitle={`Choose a CSV file exported from ${sourcePlatform.toUpperCase()} or custom layout.`}
          >
            <div className="p-8 border-2 border-dashed border-ink bg-page text-center my-2 space-y-4">
              <UploadCloud className="w-12 h-12 mx-auto text-ink" />
              <div>
                <h3 className="font-display font-bold text-base text-text uppercase">
                  Drag and drop your {currentConfig.code} CSV file here
                </h3>
                <p className="text-xs text-muted mt-1">
                  Supports UTF-8 CSV up to 25MB (max 50,000 records per migration batch).
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="lime"
                  size="md"
                  onClick={() => {
                    setSelectedFile(`${sourcePlatform}_${targetEntity}_export.csv`);
                    setStep(2);
                    showToast(`File selected: ${sourcePlatform}_${targetEntity}_export.csv`, {
                      type: "info",
                    });
                  }}
                >
                  Browse Files on Computer
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="w-4 h-4 mr-1.5 text-good" />
                  <span>Download Blank Template</span>
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2 & 3: Mapping Configuration & Data Validation Preview */}
        {step >= 2 && (
          <>
            <Card
              title="Column Mapping Configuration"
              subtitle={`Matching columns from ${selectedFile || "source CSV"} to QAVRIL LABS ${currentConfig.code} schema`}
              action={
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep(1);
                      setSelectedFile(null);
                      setImportCompleted(false);
                    }}
                  >
                    Change file
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {Object.entries(mappings).map(([sourceCol, targetField]) => (
                  <div key={sourceCol} className="p-3 bg-page border-line space-y-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                        CSV Header ({sourcePlatform})
                      </span>
                      <div className="font-bold text-xs text-text truncate" title={sourceCol}>
                        {sourceCol}
                      </div>
                    </div>

                    <ArrowRight className="w-3.5 h-3.5 text-pink" />

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-good block">
                        Target System Field
                      </span>
                      <select
                        value={targetField}
                        onChange={(e) =>
                          setMappings((prev) => ({ ...prev, [sourceCol]: e.target.value }))
                        }
                        className="w-full mt-1 px-2 py-1.5 text-xs font-bold bg-panel border-line text-text focus:outline-none"
                      >
                        {currentConfig.targetFields.map((field) => (
                          <option key={field.key} value={field.key}>
                            {field.label} {field.required ? "(Required)" : ""}
                          </option>
                        ))}
                        <option value="ignore">-- Skip / Ignore Field --</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Validation Preview Table */}
            <Card
              title={`Data Validation & Ingestion Preview (${currentConfig.code})`}
              subtitle={`${previewRows.length} rows scanned: ${validRowsCount} ready to commit, ${invalidRowsCount} quarantined`}
              featured
              action={
                <div className="flex items-center gap-2">
                  <Button
                    variant="lime"
                    size="md"
                    disabled={isImporting || validRowsCount === 0}
                    onClick={handleExecuteImport}
                    className="flex items-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin text-ink" />
                        <span>Ingesting records…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-ink" />
                        <span>Commit Import ({validRowsCount} valid rows)</span>
                      </>
                    )}
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                {/* Quarantine summary warning if errors exist */}
                {invalidRowsCount > 0 && (
                  <div className="p-3 bg-act/10 border-line text-act flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        <strong>Quarantine Active:</strong> {invalidRowsCount} record contains formatting discrepancies. You can safely proceed; invalid rows will be skipped and exported to an error log.
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-panel border-line text-[11px] font-mono font-bold text-act">
                      Strict Schema Guard
                    </span>
                  </div>
                )}

                <DataTable columns={columns} data={previewRows} />
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
