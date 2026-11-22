// Presentation labels are independent of wire protocol state identifiers.
export const presentation = {
  zh: {
    title: '设备控制台', intro: '连接 USB，查看雷达数据或调整设备配置。', advanced: '高级模式',
    empty: '连接设备后开始观测', emptyHint: '无需先选择雷达型号。',
    physical: '串口层', protocol: '协议层', controller: '主控层', radarLayer: '雷达层', usb: 'USB 串口',
    stack: '设备状态栈', unknown: '未知', response: '响应正常',
    hardware: ['固件版本', '主控型号', '芯片温度', 'MAC 地址', 'IP 地址', 'Wi-Fi', '信号强度'],
    unreported: '未上报', network: '网络与配网', scan: '搜索 SSID', scanning: '搜索中…', scanEmpty: '未发现可用网络，请靠近路由器后重新搜索。', scanUnsupported: '此固件不支持搜索网络，请使用设备热点配网。', scanFailed: '搜索未完成，请重试。', scanSelect: '选择搜索到的网络', provisioning: '配网中…', band: '工作频段', channel: '信道', open: '开放网络', passwordRequired: '需要密码', scanAuthUnsupported: '暂不支持此安全类型', signalLevels: ['信号未知', '信号较弱', '信号一般', '信号强'],
    wifiErrors: { VERIFY_FAILED: '连接验证失败，请检查网络名称、密码和信号', STORAGE_FAILED: '设备未能保存网络配置', UNSUPPORTED: '当前固件不支持此操作', BUSY: '设备正在处理其他网络任务', INVALID_ARGUMENT: '网络名称或密码格式不正确' },
    precise: '精确数值调整', dragShape: '拖动图形移动，拖动顶点或方形手柄调整大小。',
    dragPose: '拖动彩色手柄调整位置、高度和姿态。', handles: ['位置 XY', '高度 Z', '偏航', '俯仰', '横滚'],
    resize: '缩放', move: '移动', vertex: '顶点', selectArea: '编辑区域',
    waiting: '等待设备', data: '雷达数据', config: '设备配置', unread: '未读取', readable: '已读取',
    pose: '方向校准', poseHint: '设置安装位置与朝向，让雷达坐标与房间对齐。',
    boundary: '边界过滤', boundaryHint: '边界外目标仍可查看，不计入边界内判断。',
    areas: '区域占用', areasHint: '划分独立区域，供设备判断各区域是否有人。',
    unsupported: '当前固件未提供此配置。', preview: '配置预览 · 未保存',
    scene: '雷达平面视图', radar: '雷达', target: '目标', coverage: '朝向 / 覆盖示意',
    coverageHint: '扇形仅示意朝向，实际检测角度与距离未知。',
    room: '房间坐标 · 厘米', records: '观测记录与导出',
    recordHint: '仅保留最近 600 条；关闭页面前请导出。', more: '更多操作',
    inactive: '连接后可编辑配置。', noBoundary: '未设置过滤边界', addBoundary: '添加矩形边界', clearBoundary: '取消边界过滤',
    addArea: '添加区域', removeArea: '删除区域', enabled: '启用', name: '区域名称', area: '区域',
    points: '顶点坐标（厘米）', addPoint: '增加顶点', removePoint: '删除末点',
    positions: ['X 位置', 'Y 位置', '安装高度', '水平朝向', '俯仰角', '侧倾角'],
    noAreas: '尚未设置区域', areaStatus: '区域占用状态以设备上报为准。',
    diagnostics: '设备诊断', diagnosticHint: '查看设备状态与通信统计，或导出摘要用于排障。',
    statusValues: { closed: '未连接', open: '已打开', online: '已就绪', offline: '未连接', handshake: '握手中', no_response: '无响应', failed: '失败', incompatible: '版本不兼容', session_expired: '会话已过期', idle: '待命', editing: '待保存', validating: '校验中', committing: '保存中', reading: '读取中', recovering: '查询中', unknown: '待确认', conflict: '配置冲突', persisted: '已保存', saved: '已保存', none: '等待数据' },
    metrics: {
      uptime_ms: ['运行时间', '自本次启动起的毫秒数；重启后归零。'],
      radar_link: ['雷达链路', '固件报告的雷达通信状态，不代表检测精度。'],
      config_revision: ['配置版本', '识别配置变更及写入冲突，不是固件版本。'],
      config_storage: ['配置存储', '设备报告的持久化状态，不是某次保存的成功回执。'],
    },
    counters: {
      rx_frames: ['接收帧', '控制台协议累计接收帧数，不是雷达目标数量。'],
      rx_crc_errors: ['校验错误', '控制台协议 CRC 校验失败次数；持续增长时检查 USB 通信。'],
      rx_oversize: ['超长帧', '超过协议长度限制而被拒绝的帧数。'],
      invalid_requests: ['无效请求', '固件拒绝的无效协议请求数。'],
      radar_frames: ['雷达帧', '固件记录的雷达帧数，不等于有人次数。'],
      radar_errors: ['雷达错误', '固件记录的雷达通信或解析错误数。'],
      telemetry_coalesced: ['观测合并', '发送前被更新观测替换的次数，不等于雷达故障。'],
      logs_dropped: ['日志丢弃', '因缓冲或带宽限制未发送的日志数。'],
      tx_overflow: ['发送溢出', '发送队列容量不足的累计次数。'],
    }, counterHint: '非负累计计数，统计周期由固件定义；单次读数不是变化速率。',
  },
  en: {
    title: 'Device console', intro: 'Connect over USB to view radar data or configure your device.', advanced: 'Advanced mode',
    empty: 'Connect a device to start observing', emptyHint: 'No radar selection required.',
    physical: 'Serial layer', protocol: 'Protocol layer', controller: 'Controller layer', radarLayer: 'Radar layer', usb: 'USB serial',
    stack: 'Device stack', unknown: 'Unknown', response: 'Responding',
    hardware: ['Firmware', 'Controller model', 'Chip temperature', 'MAC address', 'IP address', 'Wi-Fi', 'Signal strength'],
    unreported: 'Not reported', network: 'Network & Wi-Fi setup', scan: 'Search SSIDs', scanning: 'Searching…', scanEmpty: 'No visible networks. Move closer to the router and search again.', scanUnsupported: 'This firmware cannot scan. Use the device hotspot to set up Wi-Fi.', scanFailed: 'Search incomplete. Please retry.', scanSelect: 'Choose a discovered network', provisioning: 'Connecting…', band: 'Frequency band', channel: 'Channel', open: 'Open network', passwordRequired: 'Password required', scanAuthUnsupported: 'Unsupported security type', signalLevels: ['Unknown signal', 'Weak signal', 'Fair signal', 'Strong signal'],
    wifiErrors: { VERIFY_FAILED: 'Connection verification failed; check SSID, password and signal', STORAGE_FAILED: 'The device could not save network settings', UNSUPPORTED: 'This firmware does not support the operation', BUSY: 'The device is processing another network task', INVALID_ARGUMENT: 'Check the SSID and password format' },
    precise: 'Precise values', dragShape: 'Drag the shape to move it; drag vertices or the square handle to resize.',
    dragPose: 'Drag the colored handles to change position, height and orientation.', handles: ['Position XY', 'Height Z', 'Yaw', 'Pitch', 'Roll'],
    resize: 'Resize', move: 'Move', vertex: 'Vertex', selectArea: 'Edit area',
    waiting: 'Waiting for device', data: 'Radar data', config: 'Device configuration', unread: 'Not read', readable: 'Loaded',
    pose: 'Orientation', poseHint: 'Align radar coordinates with the room using installation position and orientation.',
    boundary: 'Boundary filter', boundaryHint: 'Outside targets remain visible but do not count as inside the boundary.',
    areas: 'Area occupancy', areasHint: 'Define separate areas for device occupancy detection.',
    unsupported: 'This firmware does not expose this configuration.', preview: 'Configuration preview · unsaved',
    scene: 'Radar plan view', radar: 'Radar', target: 'Target', coverage: 'Direction / coverage sketch',
    coverageHint: 'The fan illustrates direction only; actual angle and range are unknown.',
    room: 'Room coordinates · cm', records: 'Record & export observations',
    recordHint: 'Latest 600 samples only. Export before closing this page.', more: 'More actions',
    inactive: 'Connect to edit configuration.', noBoundary: 'No filter boundary', addBoundary: 'Add rectangular boundary', clearBoundary: 'Remove boundary filter',
    addArea: 'Add area', removeArea: 'Remove area', enabled: 'Enabled', name: 'Area name', area: 'Area',
    points: 'Vertices (cm)', addPoint: 'Add vertex', removePoint: 'Remove last vertex',
    positions: ['X position', 'Y position', 'Height', 'Heading', 'Pitch', 'Roll'],
    noAreas: 'No areas configured', areaStatus: 'Occupancy is determined by device reports.',
    diagnostics: 'Device diagnostics', diagnosticHint: 'Inspect device health and communication counters, or export a troubleshooting summary.',
    statusValues: { closed: 'Disconnected', open: 'Open', online: 'Ready', offline: 'Disconnected', handshake: 'Handshaking', no_response: 'No response', failed: 'Failed', incompatible: 'Incompatible version', session_expired: 'Session expired', idle: 'Idle', editing: 'Unsaved', validating: 'Validating', committing: 'Saving', reading: 'Reading', recovering: 'Checking', unknown: 'Unconfirmed', conflict: 'Configuration conflict', persisted: 'Saved', saved: 'Saved', none: 'Waiting for data' },
    metrics: {
      uptime_ms: ['Uptime', 'Milliseconds since boot; resets on restart.'],
      radar_link: ['Radar link', 'Firmware-reported communication status, not detection accuracy.'],
      config_revision: ['Configuration revision', 'Tracks configuration changes and write conflicts, not firmware releases.'],
      config_storage: ['Configuration storage', 'Reported persistence status, not confirmation of an individual save.'],
    },
    counters: {
      rx_frames: ['Received frames', 'Console protocol frames received, not radar targets.'],
      rx_crc_errors: ['CRC errors', 'Console CRC failures; check the USB connection if increasing.'],
      rx_oversize: ['Oversized frames', 'Frames rejected for exceeding protocol length limits.'],
      invalid_requests: ['Invalid requests', 'Invalid protocol requests rejected by firmware.'],
      radar_frames: ['Radar frames', 'Radar frames recorded by firmware, not presence detections.'],
      radar_errors: ['Radar errors', 'Radar communication or parsing errors recorded by firmware.'],
      telemetry_coalesced: ['Coalesced observations', 'Samples replaced by newer data before transmission, not necessarily faults.'],
      logs_dropped: ['Dropped logs', 'Log messages omitted due to buffer or bandwidth limits.'],
      tx_overflow: ['Transmit overflow', 'Occurrences of insufficient transmit queue capacity.'],
    }, counterHint: 'Non-negative cumulative count with a firmware-defined period; not a rate.',
  },
};

export function savedConfig(snapshot) {
  return Object.fromEntries((snapshot.configItems || []).map(({ key, value }) => [key, value]));
}

export function stackStatus(snap, t, u, view = {}) {
  const label = (value) => u.statusValues[value] || t.states[value] || value;
  const port = snap.layers.port === 'open';
  const live = port && snap.sessionLive && snap.layers.protocol === 'online';
  const controller = live && !!snap.identity && Number.isFinite(snap.status?.uptime_ms);
  const radar = controller && ['present','absent'].includes(view.presence) && ['healthy','partial'].includes(snap.layers.radar);
  const identity = snap.identity || {};
  const upper = value => typeof value === 'string' && value ? value.toUpperCase() : u.unreported;
  const version = identity.protocol;
  const protocol = Number.isInteger(version?.major) && Number.isInteger(version?.minor) ? `MWCP ${version.major}.${version.minor}` : identity.host_protocol || u.unreported;
  return [
    { id: 'serial', label: u.physical, value: label(snap.layers.port), detail: u.usb, good: port },
    { id: 'protocol', label: u.protocol, value: live ? label('online') : (port ? label(snap.layers.protocol) : u.waiting), detail: protocol, good: live },
    { id: 'controller', label: u.controller, value: controller ? u.response : u.waiting, detail: `${upper(identity.chip_model)} · ${identity.firmware_version || u.unreported}`, good: controller },
    { id: 'radar', label: u.radarLayer, value: controller ? t.states[view.presence] || u.unknown : u.waiting, detail: upper(identity.configured_model), good: radar },
  ];
}
