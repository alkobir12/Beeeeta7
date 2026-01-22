"use client";

import { useEffect, useState } from "react";
import axios from "axios";

interface BalanceSheetResponse {
  success: boolean;
  report_type: string;
  generated_at: string;
  data: {
    as_of: string;
    totals: {
      assets: number;
      liabilities: number;
      equity: number;
      liabilities_plus_equity: number;
    };
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const workshopId = process.env.NEXT_PUBLIC_WORKSHOP_ID;
    if (!API_URL || !workshopId) {
      setError("لم يتم ضبط NEXT_PUBLIC_API_URL أو NEXT_PUBLIC_WORKSHOP_ID");
      return;
    }

    axios
      .get<BalanceSheetResponse>(
        `${API_URL}/api/v1/accounting/reports/balance-sheet`,
        { params: { workshop_id: workshopId } }
      )
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error(err);
        setError("فشل في جلب الميزانية العمومية");
      });
  }, []);

  if (error) {
    return <div className="text-red-400 text-sm">{error}</div>;
  }

  if (!data) {
    return <div className="text-sm text-slate-300">جاري تحميل الميزانية العمومية...</div>;
  }

  const { as_of, totals } = data.data;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الميزانية العمومية</h1>
      <p className="text-sm text-slate-300">بتاريخ: {as_of}</p>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 p-4">
          <div className="text-xs text-slate-400">إجمالي الأصول</div>
          <div className="text-xl font-semibold">{totals.assets.toFixed(2)} SAR</div>
        </div>
        <div className="rounded-lg border border-slate-700 p-4">
          <div className="text-xs text-slate-400">إجمالي الخصوم</div>
          <div className="text-xl font-semibold">{totals.liabilities.toFixed(2)} SAR</div>
        </div>
        <div className="rounded-lg border border-slate-700 p-4">
          <div className="text-xs text-slate-400">إجمالي حقوق الملكية</div>
          <div className="text-xl font-semibold">{totals.equity.toFixed(2)} SAR</div>
        </div>
        <div className="rounded-lg border border-slate-700 p-4">
          <div className="text-xs text-slate-400">الخصوم + حقوق الملكية</div>
          <div className="text-xl font-semibold">{totals.liabilities_plus_equity.toFixed(2)} SAR</div>
        </div>
      </div>
    </div>
  );
}
