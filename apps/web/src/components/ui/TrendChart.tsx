import React, { useState } from "react";
import { formatMoney } from "../../lib/currency";
import type { MonthlyTrend } from "../../types";
import { Table, BarChart3 } from "lucide-react";

export interface TrendChartProps {
  data: MonthlyTrend[];
  title?: string;
  currencySymbol?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  title = "Sales and expenses, last six months",
  currencySymbol = "$",
}) => {
  const [showTable, setShowTable] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{
    month: string;
    sales: string;
    expenses: string;
    x: number;
    y: number;
  } | null>(null);

  // Compute maximum raw value for scale
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.salesRaw, d.expensesRaw)),
    1000
  );

  return (
    <div className="w-full">
      {/* Header with Title, Legend & Table Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-4">
          <ul className="flex items-center gap-4 text-xs font-bold" aria-hidden="true">
            <li className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 bg-series-in border border-ink shadow-[1px_1px_0_var(--q-ink)]"></span>
              <span>Sales (Money in)</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 bg-series-out border border-ink shadow-[1px_1px_0_var(--q-ink)]"></span>
              <span>Expenses (Money out)</span>
            </li>
          </ul>
        </div>

        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          aria-expanded={showTable}
          aria-controls="trend-chart-table"
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-page border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-cream text-text cursor-pointer transition-transform active:translate-y-0.5"
        >
          {showTable ? (
            <>
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Show as visual chart</span>
            </>
          ) : (
            <>
              <Table className="w-3.5 h-3.5" />
              <span>Show as accessible table</span>
            </>
          )}
        </button>
      </div>

      {/* Visual Chart View */}
      {!showTable ? (
        <div className="relative pt-6 pb-2">
          {/* Tooltip */}
          {hoveredPoint && (
            <div
              className="absolute z-30 pointer-events-none -top-2 transform -translate-x-1/2 bg-panel border-line shadow-card p-2 text-xs font-bold space-y-1"
              style={{ left: `${hoveredPoint.x}%` }}
              role="status"
            >
              <div className="text-muted border-b border-grid pb-0.5 mb-1 text-[11px] uppercase">
                {hoveredPoint.month} 2026
              </div>
              <div className="flex items-center justify-between gap-4 text-series-in">
                <span>Sales:</span>
                <span>{formatMoney(hoveredPoint.sales, currencySymbol)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-series-out">
                <span>Expenses:</span>
                <span>{formatMoney(hoveredPoint.expenses, currencySymbol)}</span>
              </div>
            </div>
          )}

          {/* Chart Canvas / Columns */}
          <div className="h-52 w-full flex items-end justify-between gap-2 sm:gap-6 border-b-line pb-0 relative">
            {/* Background grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="border-b border-dashed border-ink w-full"></div>
              <div className="border-b border-dashed border-ink w-full"></div>
              <div className="border-b border-dashed border-ink w-full"></div>
            </div>

            {data.map((item, idx) => {
              const salesHeightPct = Math.max((item.salesRaw / maxVal) * 90, 4);
              const expHeightPct = Math.max((item.expensesRaw / maxVal) * 90, 4);
              const xPos = ((idx + 0.5) / data.length) * 100;

              return (
                <div
                  key={item.month}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  onMouseEnter={() =>
                    setHoveredPoint({
                      month: item.month,
                      sales: item.sales,
                      expenses: item.expenses,
                      x: xPos,
                      y: 0,
                    })
                  }
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {/* Grouped Bar Pair */}
                  <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-full z-10">
                    {/* Sales Column (Money In) */}
                    <div
                      style={{ height: `${salesHeightPct}%` }}
                      className="w-1/2 max-w-[28px] bg-series-in border-line border-b-0 rounded-t-[4px] shadow-[2px_0_0_var(--q-ink)] group-hover:brightness-110 transition-all"
                    ></div>
                    {/* Expenses Column (Money Out) */}
                    <div
                      style={{ height: `${expHeightPct}%` }}
                      className="w-1/2 max-w-[28px] bg-series-out border-line border-b-0 rounded-t-[4px] shadow-[2px_0_0_var(--q-ink)] group-hover:brightness-110 transition-all"
                    ></div>
                  </div>

                  {/* Month Label */}
                  <span className="mt-2 text-xs font-bold text-muted group-hover:text-text">
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Accessible Table View */
        <div id="trend-chart-table" className="neo-table-wrapper border-line mt-2">
          <table className="neo-table">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col" className="text-right">Sales (Money In)</th>
                <th scope="col" className="text-right">Expenses (Money Out)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.month}>
                  <td className="font-bold">{row.month} 2026</td>
                  <td className="text-right font-mono font-bold text-series-in">
                    {formatMoney(row.sales, currencySymbol)}
                  </td>
                  <td className="text-right font-mono font-bold text-series-out">
                    {formatMoney(row.expenses, currencySymbol)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
