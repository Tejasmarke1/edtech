import React from 'react';
import Card from '../../../components/ui/Card';

export const StatCard = ({ title, value, icon, colorClass = 'blue' }) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  const bgClass = colorMap[colorClass] || colorMap.blue;

  return (
    <Card hoverable className="cursor-pointer">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
        {icon && (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 ${bgClass}`}>
            {icon}
          </div>
        )}
      </div>
      <p className="text-4xl font-extrabold text-slate-900 transition-colors">{value}</p>
    </Card>
  );
};
