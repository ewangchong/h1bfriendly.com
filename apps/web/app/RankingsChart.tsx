'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

type TrendData = {
    year: number;
    filings: number;
    approvals: number;
    avg_salary: number | string;
};

export default function RankingsChart({ trend }: { trend: TrendData[] }) {
    if (!trend || trend.length === 0) return null;

    return (
        <div style={{ width: '100%', minWidth: 0, height: 260, marginTop: 24, marginBottom: 12 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={220}>
                <BarChart
                    data={trend}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis
                        dataKey="year"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 13, fill: '#666' }}
                        dy={8}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 13, fill: '#666' }}
                        tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                    />
                    <Tooltip
                        cursor={{ fill: '#f4f4f5' }}
                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                        labelStyle={{ fontWeight: 'bold', color: '#111', marginBottom: 4 }}
                    />
                    <Bar
                        dataKey="approvals"
                        name="Approvals"
                        fill="#059669"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={60}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
