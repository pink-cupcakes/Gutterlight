import { CW, CH, scenes, districtBoundary, streetBounds } from './city.js';
export function drawCityMap(canvas, s, large = false) {
  const ctx = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#102019';
  ctx.fillRect(0, 0, w, h);
  const sx = w / 8,
    sy = h / 4,
    point = (id) => ({ x: (scenes[id].map[0] + 1) * sx, y: (scenes[id].map[1] + 1) * sy });
  const discovered = new Set(s.city.visited);
  const known = new Set(discovered);
  for (const id of discovered) for (const to of Object.values(scenes[id].neighbors)) known.add(to);
  ctx.lineWidth = large ? 3 : 2;
  for (const id of known) {
    const a = point(id);
    for (const to of Object.values(scenes[id].neighbors)) {
      if (!known.has(to) || (!discovered.has(id) && !discovered.has(to))) continue;
      const b = point(to);
      const shortcut = (id === 'boiler' && to === 'cable') || (id === 'cable' && to === 'boiler');
      ctx.strokeStyle = shortcut ? (s.city.shortcut ? '#d0bb7d' : '#705b43') : '#6d8061';
      ctx.setLineDash(shortcut && !s.city.shortcut ? [4, 5] : []);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  for (const id of known) {
    const p = point(id),
      current = id === s.zone;
    ctx.fillStyle = current ? '#dce9b7' : discovered.has(id) ? '#91a773' : '#384c3b';
    ctx.strokeStyle = current ? '#f6edc3' : '#728261';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, current ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (large) {
      ctx.textAlign = 'center';
      ctx.font = '13px sans-serif';
      ctx.fillStyle = current ? '#eee8c7' : '#b5c3a2';
      ctx.fillText(discovered.has(id) ? scenes[id].name : 'Unexplored street', p.x, p.y + 24);
    }
  }
}

export function drawMinimap(canvas, state, places, target, direction) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const center = size / 2;
  const x = (value) => center + ((value - CW / 2) * size) / (CW * 1.2);
  const y = (value) => center + ((value - CH * 0.6) * size) / (CH * 1.23);
  const boundary = state.zone === 'district' ? districtBoundary : streetBounds[state.zone];

  ctx.fillStyle = '#211e1a';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#6a594233';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let grid = 20; grid < size; grid += 20) {
    ctx.moveTo(grid, 0);
    ctx.lineTo(grid, size);
    ctx.moveTo(0, grid);
    ctx.lineTo(size, grid);
  }
  ctx.stroke();

  for (const place of Object.values(places)) {
    if (!place.exit) continue;
    const px = x(place.x);
    const py = y(place.y);
    ctx.strokeStyle = place.locked ? '#6f5c43' : '#8f7b57';
    ctx.lineWidth = 15;
    ctx.setLineDash(place.locked ? [6, 6] : []);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(
      place.dir === 'west' ? 0 : place.dir === 'east' ? size : px,
      place.dir === 'north' ? 0 : place.dir === 'south' ? size : py,
    );
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = '#5c5346';
  ctx.strokeStyle = '#ab9672';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [px, py] of boundary) ctx.lineTo(x(px), y(py));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  for (const [id, place] of Object.entries(places)) {
    const px = x(place.x);
    const py = y(place.y);
    const tracked = id === target;
    if (tracked) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#261b11';
      ctx.strokeStyle = '#efbc50';
      ctx.lineWidth = 3;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
      ctx.fillStyle = '#ffcd60';
      ctx.fillRect(px - 1.5, py - 5, 3, 6);
      ctx.fillRect(px - 1.5, py + 2.5, 3, 3);
    } else {
      ctx.fillStyle = place.exit ? '#bca47a' : '#9b8c73';
      ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
    }
  }

  ctx.save();
  ctx.translate(x(state.x), y(state.y));
  ctx.rotate([Math.PI, Math.PI / 2, 0, -Math.PI / 2][direction]);
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(8, 9);
  ctx.lineTo(0, 5);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fillStyle = '#fff0bd';
  ctx.strokeStyle = '#302216';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}
