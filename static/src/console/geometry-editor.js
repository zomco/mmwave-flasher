export const isPoint = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
export const clamp = (n, min = -2000, max = 2000) => Math.max(min, Math.min(max, n));
export const headingPoint = (x,y,yaw,distance) => [x+distance*Math.sin(yaw*Math.PI/180),y+distance*Math.cos(yaw*Math.PI/180)];

export function polygonBounds(points) {
  return [Math.min(...points.map(p=>p[0])), Math.min(...points.map(p=>p[1])), Math.max(...points.map(p=>p[0])), Math.max(...points.map(p=>p[1]))];
}

// Every gesture starts from its pointer-down snapshot; repeated moves cannot accumulate drift.
export function editPolygon(points, mode, index, dx, dy) {
  if (points.length < 3 || !points.every(isPoint) || !Number.isFinite(dx) || !Number.isFinite(dy)) return points;
  const [x0,y0,x1,y1] = polygonBounds(points);
  if (mode === 'move') {
    dx = clamp(dx,-2000-x0,2000-x1); dy = clamp(dy,-2000-y0,2000-y1);
    return points.map(p=>[Math.round(p[0]+dx),Math.round(p[1]+dy)]);
  }
  if (mode === 'resize') {
    if (x1 <= x0 || y1 <= y0) return points;
    const w = clamp(x1-x0+dx,1,2000-x0), h = clamp(y1-y0+dy,1,2000-y0);
    return points.map(p=>[Math.round(x0+(p[0]-x0)*w/(x1-x0)),Math.round(y0+(p[1]-y0)*h/(y1-y0))]);
  }
  return points.map((p,i)=>i===index ? [Math.round(clamp(p[0]+dx)),Math.round(clamp(p[1]+dy))] : [...p]);
}

export function svgPoint(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  return new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
}

// Same installation basis as mmwave-card: yaw toward +X, positive pitch down.
export function scanVector(yaw, pitch, roll, azimuth, elevation, length) {
  const [a,b,c,h,v] = [yaw,pitch,roll,azimuth,elevation].map(n=>n*Math.PI/180);
  const forward = [Math.sin(a)*Math.cos(b),Math.cos(a)*Math.cos(b),-Math.sin(b)];
  const right = [Math.cos(a),-Math.sin(a),0];
  const down = [-Math.sin(a)*Math.sin(b),-Math.cos(a)*Math.sin(b),-Math.cos(b)];
  return forward.map((f,i)=>length*(f*Math.cos(v)*Math.cos(h)+(right[i]*Math.cos(c)+down[i]*Math.sin(c))*Math.cos(v)*Math.sin(h)+(down[i]*Math.cos(c)-right[i]*Math.sin(c))*Math.sin(v)));
}
