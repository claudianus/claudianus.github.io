/**
 * 히어로 캔버스: superliora 에이전트 네트워크 시각화.
 * 노드 = 세션/에이전트, 엣지 = 작업 흐름. 마우스 인터랙션 + 펄스.
 * prefers-reduced-motion 환경에서는 정적 프레임 1회만 렌더링.
 */

const canvas = document.querySelector<HTMLCanvasElement>('#agent-canvas');

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

interface AgentNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hub: boolean;
  label?: string;
}

interface Pulse {
  from: number;
  to: number;
  t: number;
  speed: number;
}

const HUB_LABELS = ['orchestrator', 'planner', 'worker-01', 'memory'];

function createNodes(w: number, h: number): AgentNode[] {
  const count = Math.max(28, Math.min(64, Math.floor((w * h) / 24000)));
  const nodes: AgentNode[] = [];
  for (let i = 0; i < count; i++) {
    const hub = i < HUB_LABELS.length;
    nodes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: hub ? 4.2 : 1.4 + Math.random() * 1.4,
      hub,
      label: hub ? HUB_LABELS[i] : undefined,
    });
  }
  return nodes;
}

function initAgentCanvas(): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let nodes: AgentNode[] = [];
  let pulses: Pulse[] = [];
  let rafId = 0;
  let running = false;
  const pointer = { x: -9999, y: -9999 };

  const LINK_DIST = 150;
  const CURSOR_DIST = 190;
  const MAX_PULSES = 14;

  function resize(): void {
    const rect = canvas!.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = Math.round(width * dpr);
    canvas!.height = Math.round(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    nodes = createNodes(width, height);
    pulses = [];
    if (REDUCED_MOTION) drawFrame(0);
  }

  function step(): void {
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;

      // 경계 완전 반사 대신 부드럽게 되감기
      if (n.x < -20) n.x = width + 20;
      if (n.x > width + 20) n.x = -20;
      if (n.y < -20) n.y = height + 20;
      if (n.y > height + 20) n.y = -20;

      // 마우스 반발력
      const dx = n.x - pointer.x;
      const dy = n.y - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 160 * 160 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const force = ((160 - d) / 160) * 0.55;
        n.x += (dx / d) * force;
        n.y += (dy / d) * force;
      }
    }
  }

  function drawFrame(now: number): void {
    ctx!.clearRect(0, 0, width, height);

    // 근접 엣지
    const linked: Array<[number, number]> = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= LINK_DIST) continue;
        linked.push([i, j]);
        const alpha = (1 - dist / LINK_DIST) * 0.24;
        ctx!.strokeStyle = `rgba(140, 165, 185, ${alpha.toFixed(3)})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }
    }

    // 커서 연결 (작업 지시선)
    if (pointer.x > 0) {
      for (const n of nodes) {
        const dist = Math.hypot(n.x - pointer.x, n.y - pointer.y);
        if (dist >= CURSOR_DIST) continue;
        const alpha = (1 - dist / CURSOR_DIST) * 0.55;
        ctx!.strokeStyle = `rgba(79, 216, 184, ${alpha.toFixed(3)})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(pointer.x, pointer.y);
        ctx!.lineTo(n.x, n.y);
        ctx!.stroke();
      }
      ctx!.fillStyle = 'rgba(79, 216, 184, 0.9)';
      ctx!.beginPath();
      ctx!.arc(pointer.x, pointer.y, 2.2, 0, Math.PI * 2);
      ctx!.fill();
    }

    // 펄스: 엣지를 따라 흐르는 작업 신호
    if (linked.length > 0 && pulses.length < MAX_PULSES && Math.random() < 0.12) {
      const [from, to] = linked[(Math.random() * linked.length) | 0];
      pulses.push({ from, to, t: 0, speed: 0.008 + Math.random() * 0.012 });
    }
    pulses = pulses.filter((p) => p.t <= 1);
    for (const p of pulses) {
      p.t += p.speed;
      const a = nodes[p.from];
      const b = nodes[p.to];
      if (!a || !b) continue;
      const x = a.x + (b.x - a.x) * p.t;
      const y = a.y + (b.y - a.y) * p.t;
      const fade = Math.sin(p.t * Math.PI);
      ctx!.fillStyle = `rgba(116, 240, 210, ${(fade * 0.95).toFixed(3)})`;
      ctx!.beginPath();
      ctx!.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx!.fill();
    }

    // 노드
    for (const n of nodes) {
      if (n.hub) {
        ctx!.strokeStyle = 'rgba(79, 216, 184, 0.75)';
        ctx!.lineWidth = 1.2;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.fillStyle = 'rgba(79, 216, 184, 0.25)';
        ctx!.fill();
        if (n.label) {
          ctx!.font = '10px "JetBrains Mono", monospace';
          ctx!.fillStyle = 'rgba(147, 163, 179, 0.85)';
          ctx!.fillText(n.label, n.x + n.r + 6, n.y + 3);
        }
      } else {
        ctx!.fillStyle = 'rgba(233, 238, 243, 0.65)';
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fill();
      }
    }
    void now;
  }

  function loop(now: number): void {
    if (!running) return;
    step();
    drawFrame(now);
    rafId = requestAnimationFrame(loop);
  }

  function start(): void {
    if (running || REDUCED_MOTION) return;
    running = true;
    rafId = requestAnimationFrame(loop);
  }

  function stop(): void {
    running = false;
    cancelAnimationFrame(rafId);
  }

  const onPointerMove = (e: PointerEvent): void => {
    const rect = canvas!.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
  };
  const onPointerLeave = (): void => {
    pointer.x = -9999;
    pointer.y = -9999;
  };
  const onVisibility = (): void => {
    document.hidden ? stop() : start();
  };

  canvas.setAttribute('aria-hidden', 'true');
  resize();

  if (REDUCED_MOTION) return; // 정적 프레임만 렌더링

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  document.addEventListener('visibilitychange', onVisibility);
  start();
}

initAgentCanvas();
