import React from 'react';
import { metricPresentation } from './live-metrics.js';

export default function LiveMetrics({ reading, rows, model, language, t }) {
  const zh = language === 'zh';
  const fields = (reading.vitalFields || []).map(f => metricPresentation(f, language, t.states, model));
  const groups = [
    ['native', zh ? '雷达原生数据' : 'Radar measurements'],
    ['enhanced', zh ? '固件增强状态' : 'Firmware enhancements'],
    ['extension', zh ? '其他设备数据' : 'Device extensions'],
  ];
  return <div className="grid gap-6 border-t border-slate-200 p-4 text-sm dark:border-white/10 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" data-testid="live-metrics">
    {groups.map(([key, title]) => {
      const items = fields.filter(f => f.group === key);
      if (key === 'extension' && !items.length) return null;
      return <section key={key} data-testid={'metrics-' + key}>
        <h4 className="mb-3 text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400">{title}</h4>
        <dl className={'grid gap-x-5 gap-y-4 ' + (key === 'native' ? 'sm:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-1')}>
          {key === 'native' && <Metric label={zh ? '人体存在' : 'Human presence'} value={t.states[reading.presence] || reading.presence} help={zh ? '雷达直接判断是否有人' : 'Presence reported directly by the radar'}/>}
          {key === 'native' && !items.some(f => f.key === 'distance.cm') && rows.filter(row => row.oneD).map(row => <Metric key={row.key} label={zh ? '目标距离' : 'Target distance'} value={row.rangeCm == null ? '—' : row.rangeCm + ' cm'} help={(zh ? '目标与雷达之间的距离' : 'Distance between target and radar') + ' · ' + (t.states[row.quality] || row.quality)}/>)}
          {items.map(f => <Metric key={f.key} {...f}/>)}
          {key === 'enhanced' && rows.filter(row => !row.oneD).map(row => <Metric key={row.key}
            label={(zh ? '房间位置' : 'Room position') + (rows.length > 1 ? ' · ' + row.key : '')}
            value={row.oneD ? row.rangeCm + ' cm' : Array.isArray(row.room) ? row.room.map(n => Number(n).toFixed(0)).join(', ') + ' cm' : '—'}
            help={(zh ? '方向校准后的坐标' : 'Coordinates after installation calibration') + ' · ' + (t.states[row.quality] || row.quality) + (row.faded ? ' · ' + t.outside : '')}/>)}
          {key === 'enhanced' && !items.length && !rows.some(row => !row.oneD) && <p className="muted text-xs">{zh ? '暂无增强状态上报' : 'No enhancement status reported'}</p>}
        </dl>
      </section>;
    })}
  </div>;
}

function Metric({ label, value, help }) {
  return <div className="min-w-0"><dt className="text-xs font-medium">{label}</dt><dd className="mt-1 break-words text-base font-semibold tabular-nums">{value}</dd><dd className="muted mt-1 text-xs leading-5">{help}</dd></div>;
}
