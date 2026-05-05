(() => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const roleTarget = document.getElementById("typed-role");
  const roles = [
    "Creative Software Developer",
    "Full-stack Product Builder",
    "ML + Finance Analyst",
    "C++ Problem Solver",
  ];

  if (roleTarget && !prefersReducedMotion) {
    let roleIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const typeRole = () => {
      const current = roles[roleIndex];
      roleTarget.textContent = current.slice(0, charIndex);

      if (!deleting && charIndex < current.length) {
        charIndex += 1;
        window.setTimeout(typeRole, 64);
        return;
      }

      if (!deleting && charIndex === current.length) {
        deleting = true;
        window.setTimeout(typeRole, 1250);
        return;
      }

      if (deleting && charIndex > 0) {
        charIndex -= 1;
        window.setTimeout(typeRole, 34);
        return;
      }

      deleting = false;
      roleIndex = (roleIndex + 1) % roles.length;
      window.setTimeout(typeRole, 260);
    };

    window.setTimeout(typeRole, 1200);
  }

  const canvas = document.getElementById("hero-canvas");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: true });
  const palette = {
    acid: "216, 255, 63",
    cyan: "85, 214, 255",
    rose: "255, 79, 139",
    paper: "246, 241, 232",
  };

  let width = 0;
  let height = 0;
  let ratio = 1;
  let nodes = [];
  let chart = [];
  const codeSnippets = ["React", "C++", "SQL", "ML", "AAPL", "NVDA", "API", "Data"];

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.floor(bounds.width));
    height = Math.max(1, Math.floor(bounds.height));
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const nodeCount = width < 760 ? 34 : 64;
    nodes = Array.from({ length: nodeCount }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.42,
      vy: (Math.random() - 0.5) * 0.42,
      r: index % 7 === 0 ? 2.2 : 1.3,
      color: index % 5 === 0 ? palette.acid : index % 3 === 0 ? palette.rose : palette.cyan,
    }));

    const points = width < 760 ? 7 : 10;
    chart = Array.from({ length: points }, (_, index) => ({
      x: width * 0.11 + index * ((width * 0.78) / (points - 1)),
      y: height * (0.72 - Math.sin(index * 0.85) * 0.08 - (index / points) * 0.18),
    }));
  };

  const drawChart = (time) => {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(${palette.acid}, 0.45)`;
    ctx.shadowColor = `rgba(${palette.acid}, 0.35)`;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    chart.forEach((point, index) => {
      const y = point.y + Math.sin(time * 0.0014 + index) * 13;
      if (index === 0) {
        ctx.moveTo(point.x, y);
      } else {
        ctx.lineTo(point.x, y);
      }
    });
    ctx.stroke();

    chart.forEach((point, index) => {
      const pulse = 3 + Math.sin(time * 0.004 + index) * 1.8;
      ctx.fillStyle = `rgba(${index % 2 ? palette.rose : palette.acid}, 0.75)`;
      ctx.beginPath();
      ctx.arc(point.x, point.y + Math.sin(time * 0.0014 + index) * 13, pulse, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  };

  const drawNodes = () => {
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      node.x += node.vx;
      node.y += node.vy;

      if (node.x < -20) node.x = width + 20;
      if (node.x > width + 20) node.x = -20;
      if (node.y < -20) node.y = height + 20;
      if (node.y > height + 20) node.y = -20;

      for (let j = i + 1; j < nodes.length; j += 1) {
        const other = nodes[j];
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 150) {
          ctx.strokeStyle = `rgba(${palette.paper}, ${0.12 - distance / 1600})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
        }
      }

      ctx.fillStyle = `rgba(${node.color}, 0.72)`;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawCode = (time) => {
    ctx.save();
    ctx.font = "700 12px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    codeSnippets.forEach((snippet, index) => {
      const lane = index % 4;
      const x = ((time * (0.018 + lane * 0.004) + index * 190) % (width + 240)) - 120;
      const y = height * (0.2 + lane * 0.18) + Math.sin(time * 0.001 + index) * 18;
      ctx.fillStyle = `rgba(${index % 2 ? palette.cyan : palette.acid}, 0.18)`;
      ctx.fillText(snippet, x, y);
    });
    ctx.restore();
  };

  const render = (time = 0) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(5, 6, 9, 0.24)";
    ctx.fillRect(0, 0, width, height);
    drawChart(time);
    drawNodes();
    drawCode(time);

    if (!prefersReducedMotion) {
      window.requestAnimationFrame(render);
    }
  };

  resize();
  render();
  window.addEventListener("resize", resize);
})();
