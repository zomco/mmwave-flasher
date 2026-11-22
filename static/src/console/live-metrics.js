// Names and units describe wire values; freshness is supplied by observationView.
const definitions = {
  'distance.cm': ['目标距离', 'Target distance', 'cm', '目标与雷达之间的距离', 'Distance between target and radar'],
  breath_rate: ['呼吸频率', 'Breathing rate', '次/分', '雷达估计的每分钟呼吸次数，非医疗测量', 'Estimated breaths per minute; not a medical measurement'],
  heart_rate: ['心率', 'Heart rate', '次/分', '雷达估计的每分钟心跳次数，非医疗测量', 'Estimated heartbeats per minute; not a medical measurement'],
  'diagnostics.local_z': ['雷达坐标高度', 'Radar-local height', 'cm', '目标在雷达自身坐标中的 Z 值，不是离地高度', 'Target Z in radar coordinates, not height above the floor'],
  'speed.cm_s': ['移动速度', 'Movement speed', 'cm/s', '雷达上报的目标移动速度', 'Target speed reported by the radar'],
  'motion.state': ['活动状态', 'Activity state', '', '雷达判断的静止或活动状态', 'Still or active state reported by the radar'],
  'body.movement': ['体动幅度', 'Body movement', '', '雷达上报的体动指数（0–100）', 'Radar-reported movement index (0–100)'],
  'sleep.state': ['睡眠状态', 'Sleep state', '', '雷达估计的睡眠状态，非医疗判断', 'Radar-estimated sleep state; not a medical assessment'],
  'areas.occupancy': ['区域占用', 'Area occupancy', '', '固件根据配置的区域判断是否有人', 'Presence within areas configured in firmware'],
};

export function metricPresentation(field, language, states, model = '') {
  const zh = language === 'zh', d = definitions[field.key];
  const label = d ? d[zh ? 0 : 1] : (zh ? '其他测量' : 'Additional measurement') + ' · ' + field.key;
  const help = d ? d[zh ? 3 : 4] : (zh ? '设备扩展字段，含义由固件定义' : 'Device extension; meaning defined by firmware');
  let value = states[field.state] || field.state;
  if (field.state === 'valid') {
    value = field.value == null ? (states.unknown || '—') : typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value);
    if (field.key === 'areas.occupancy') {
      const occupied = v => v === true ? (zh ? '有人' : 'Occupied') : v === false ? (zh ? '无人' : 'Clear') : (states.unknown || '—');
      if (typeof field.value === 'boolean') value = occupied(field.value);
      else if (Array.isArray(field.value) && field.value.every(v => typeof v === 'boolean' || v === null)) {
        value = field.value.length ? field.value.map((v, i) => (zh ? '区域 ' : 'Area ') + (i + 1) + ' · ' + occupied(v)).join(' / ') : (zh ? '无区域结果' : 'No area results');
      }
    }
    // Numeric enum meanings are model-specific, never extrapolate to other radar models.
    if (String(model).toUpperCase() === 'R60ABD1') {
      const enums = {
        'motion.state': zh ? ['无活动', '静止', '活跃'] : ['No activity', 'Still', 'Active'],
        'sleep.state': zh ? ['深睡', '浅睡', '清醒', '无睡眠状态'] : ['Deep sleep', 'Light sleep', 'Awake', 'No sleep state'],
      };
      if (enums[field.key] && Number.isInteger(field.value)) value = enums[field.key][field.value] ?? value;
    }
    if (d?.[2] && typeof field.value === 'number') value += ' ' + (zh ? d[2] : d[2] === '次/分' ? (field.key === 'heart_rate' ? 'bpm' : 'breaths/min') : d[2]);
  }
  return { key: field.key, label, help, value, group: field.key.startsWith('areas.') ? 'enhanced' : d ? 'native' : 'extension' };
}

export function signalLevel(rssi) {
  return !Number.isFinite(rssi) ? 0 : rssi >= -55 ? 3 : rssi >= -70 ? 2 : 1;
}
