(() => {
  const controls = [...document.querySelectorAll(
    'a[href], button:not(:disabled), input[type="button"]:not(:disabled), input[type="submit"]:not(:disabled), [role="button"]',
  )];
  if (!controls.length) return;

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const padding = 104;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  const instances = [];
  let activeInstance = null;

  controls.forEach((button) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const effectScale = button.matches("[data-cybernetic-liquid], .btn.primary, .project-link") ? 1 : 0.42;
    const strands = Array.from({ length: 5 }, (_, index) => ({
      angleOffset: (index - 2) * 0.16,
      anchorOffset: (index - 2) * 5,
      sway: ((index % 2 ? -1 : 1) * (0.025 + index * 0.008)),
      length: 34 + ((index * 37) % 54),
      radius: 1.4 + ((index * 13) % 25) / 10,
      bend: (index % 2 ? -1 : 1) * (6 + ((index * 11) % 17)),
      nodes: Array.from({ length: 9 }, () => ({ x: 0, y: 0, vx: 0, vy: 0 })),
    }));
    const pointer = { x: 0, y: 0, vx: 0, vy: 0, lastX: 0, lastY: 0, lastTime: 0, clientX: null, clientY: null };
    let width = 0;
    let height = 0;
    let energy = 0;
    let energyTarget = 0;
    let frameId = 0;
    let pulseTimer = 0;
    let previousTime = 0;
    let initialized = false;
    let resizeObserver = null;

    canvas.className = "cybernetic-liquid-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.width = "0px";
    canvas.style.height = "0px";
    button.classList.add("cybernetic-liquid-host");
    button.insertBefore(canvas, button.firstChild);

    function resize() {
      if (!initialized) return;
      const rect = button.getBoundingClientRect();
      width = rect.width + padding * 2;
      height = rect.height + padding * 2;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.left = `${-padding}px`;
      canvas.style.top = `${-padding}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      resetStrands();
    }

    function initialize() {
      if (initialized) return;
      initialized = true;
      resize();
      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(button);
      }
    }

    function releaseCanvas() {
      if (!initialized) return;
      context.clearRect(0, 0, width, height);
      canvas.width = 1;
      canvas.height = 1;
      canvas.style.width = "0px";
      canvas.style.height = "0px";
      initialized = false;
      resizeObserver?.disconnect();
      resizeObserver = null;
    }

    function resetStrands() {
      const rect = button.getBoundingClientRect();
      const centerX = padding + rect.width / 2;
      const pointerX = Number.isFinite(pointer.x) ? pointer.x : centerX;
      const anchorCenterX = Math.max(
        padding + 18,
        Math.min(pointerX, padding + rect.width - 18),
      );

      strands.forEach((strand) => {
        strand.anchor = {
          x: anchorCenterX + strand.anchorOffset,
          y: padding + rect.height - 1,
        };
        strand.directionX = strand.sway;
        strand.directionY = 1;
        strand.nodes.forEach((node, index) => {
          const progress = index / (strand.nodes.length - 1);
          node.x = strand.anchor.x + strand.directionX * strand.length * progress;
          node.y = strand.anchor.y + strand.length * progress;
          node.vx = 0;
          node.vy = 0;
        });
      });
    }

    function requestFrame() {
      if (!frameId && !motionPreference.matches && (energy > 0 || energyTarget > 0)) {
        initialize();
        frameId = window.requestAnimationFrame(render);
      }
    }

    function getLocalPointer(event) {
      const rect = button.getBoundingClientRect();
      return {
        x: event.clientX - rect.left + padding,
        y: event.clientY - rect.top + padding,
      };
    }

    function updatePointer(event) {
      if (event.pointerType === "touch" || motionPreference.matches) return;
      const point = getLocalPointer(event);
      const now = performance.now();
      const elapsed = Math.max(12, now - (pointer.lastTime || now));
      pointer.vx = Math.max(-1.6, Math.min(1.6, (point.x - pointer.lastX) / elapsed));
      pointer.vy = Math.max(-1.6, Math.min(1.6, (point.y - pointer.lastY) / elapsed));
      pointer.x = point.x;
      pointer.y = point.y;
      pointer.clientX = event.clientX;
      pointer.clientY = event.clientY;
      pointer.lastX = point.x;
      pointer.lastY = point.y;
      pointer.lastTime = now;

      const rect = button.getBoundingClientRect();
      const nearestX = Math.max(rect.left, Math.min(event.clientX, rect.right));
      const nearestY = Math.max(rect.top, Math.min(event.clientY, rect.bottom));
      const distance = Math.hypot(event.clientX - nearestX, event.clientY - nearestY);
      const isNear = distance < 76;
      if (isNear) initialize();
      if (distance < 76 && energyTarget === 0 && energy < 0.02) resetStrands();
      energyTarget = isNear ? 1 : 0;
      const magneticInfluence = Math.max(0, 1 - distance / 100);

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const magneticX = Math.max(-3.5, Math.min(3.5, ((event.clientX - centerX) / rect.width) * 3.5)) * magneticInfluence * effectScale;
      const magneticY = Math.max(-3.5, Math.min(3.5, ((event.clientY - centerY) / rect.height) * 3.5)) * magneticInfluence * effectScale;
      button.style.setProperty("--magnetic-x", `${magneticX.toFixed(2)}px`);
      button.style.setProperty("--magnetic-y", `${magneticY.toFixed(2)}px`);
      if (isNear || energy > 0) requestFrame();
    }

    function traceSoftShape(points, widths) {
      const left = [];
      const right = [];

      points.forEach((point, index) => {
        const before = points[Math.max(0, index - 1)];
        const after = points[Math.min(points.length - 1, index + 1)];
        const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
        const normalX = -(after.y - before.y) / length;
        const normalY = (after.x - before.x) / length;
        left.push({ x: point.x + normalX * widths[index], y: point.y + normalY * widths[index] });
        right.push({ x: point.x - normalX * widths[index], y: point.y - normalY * widths[index] });
      });

      context.beginPath();
      context.moveTo(left[0].x, left[0].y);
      for (let index = 1; index < left.length; index += 1) {
        const midpoint = { x: (left[index - 1].x + left[index].x) / 2, y: (left[index - 1].y + left[index].y) / 2 };
        context.quadraticCurveTo(left[index - 1].x, left[index - 1].y, midpoint.x, midpoint.y);
      }
      context.lineTo(left[left.length - 1].x, left[left.length - 1].y);
      context.lineTo(right[right.length - 1].x, right[right.length - 1].y);
      for (let index = right.length - 2; index > 0; index -= 1) {
        const midpoint = { x: (right[index + 1].x + right[index].x) / 2, y: (right[index + 1].y + right[index].y) / 2 };
        context.quadraticCurveTo(right[index + 1].x, right[index + 1].y, midpoint.x, midpoint.y);
      }
      context.lineTo(right[0].x, right[0].y);
      context.closePath();
    }

    function drawStrand(strand, time, intensity, rect) {
      const rectPointerX = pointer.x - (padding + rect.width / 2);
      const directionX = Math.max(-0.2, Math.min(0.2,
        rectPointerX / Math.max(rect.width, 1) * 0.35 + strand.sway,
      ));
      const directionY = Math.sqrt(1 - directionX * directionX);
      const anchorCenterX = Math.max(
        padding + 18,
        Math.min(pointer.x, padding + rect.width - 18),
      );
      const anchor = {
        x: anchorCenterX + strand.anchorOffset,
        y: padding + rect.height - 1,
      };
      strand.anchor = anchor;
      strand.nodes[0].x = anchor.x;
      strand.nodes[0].y = anchor.y;
      strand.nodes[0].vx = 0;
      strand.nodes[0].vy = 0;
      const bend = strand.bend * intensity + Math.sin(time * 0.0017 + strand.angleOffset * 5) * 4 * intensity;

      for (let index = 1; index < strand.nodes.length; index += 1) {
        const node = strand.nodes[index];
        const progress = index / (strand.nodes.length - 1);
        const normalX = -directionY;
        const normalY = directionX;
        const pointerInfluence = Math.max(0, 1 - Math.abs(rectPointerX - strand.anchorOffset) / Math.max(rect.width * 0.55, 1));
        const targetX = anchor.x + directionX * strand.length * progress + normalX * Math.sin(progress * Math.PI) * bend + pointer.vx * progress * 15 * pointerInfluence;
        const targetY = anchor.y + directionY * strand.length * progress + normalY * Math.sin(progress * Math.PI) * bend + pointer.vy * progress * 8 * pointerInfluence;
        const spring = 34;
        node.vx = (node.vx + (targetX - node.x) * spring * frameDelta) * Math.exp(-7.5 * frameDelta);
        node.vy = (node.vy + (targetY - node.y) * spring * frameDelta) * Math.exp(-7.5 * frameDelta);
        node.x += node.vx * frameDelta;
        node.y += node.vy * frameDelta;
      }

      const segmentLength = strand.length / (strand.nodes.length - 1);
      for (let pass = 0; pass < 2; pass += 1) {
        for (let index = 1; index < strand.nodes.length; index += 1) {
          const previous = strand.nodes[index - 1];
          const node = strand.nodes[index];
          const dx = node.x - previous.x;
          const dy = node.y - previous.y;
          const distance = Math.hypot(dx, dy) || 1;
          const correction = (distance - segmentLength) / distance;
          if (index === 1) {
            node.x -= dx * correction;
            node.y -= dy * correction;
          } else {
            previous.x += dx * correction * 0.5;
            previous.y += dy * correction * 0.5;
            node.x -= dx * correction * 0.5;
            node.y -= dy * correction * 0.5;
          }
        }
        strand.nodes[0].x = anchor.x;
        strand.nodes[0].y = anchor.y;
      }

      const points = strand.nodes.map((node) => ({ x: node.x, y: node.y }));
      const widths = strand.nodes.map((_, index) => {
        const progress = index / (strand.nodes.length - 1);
        return (0.35 + Math.sin(Math.PI * Math.pow(progress, 0.78)) * strand.radius) * intensity;
      });

      context.globalAlpha = intensity;
      traceSoftShape(points, widths);
      const gradient = context.createLinearGradient(points[0].x, points[0].y, points[points.length - 1].x, points[points.length - 1].y);
      gradient.addColorStop(0, "rgba(86, 93, 96, 0.98)");
      gradient.addColorStop(0.26, "rgba(31, 35, 38, 0.99)");
      gradient.addColorStop(0.74, "rgba(7, 9, 10, 0.99)");
      gradient.addColorStop(1, "rgba(31, 35, 37, 0.94)");
      context.fillStyle = gradient;
      context.shadowColor = "rgba(25, 196, 226, 0.34)";
      context.shadowBlur = 7 * intensity;
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = `rgba(76, 195, 216, ${0.24 * intensity})`;
      context.lineWidth = 0.65;
      context.stroke();

      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length - 1; index += 1) {
        const midpointX = (points[index].x + points[index + 1].x) / 2;
        const midpointY = (points[index].y + points[index + 1].y) / 2;
        context.quadraticCurveTo(points[index].x, points[index].y, midpointX, midpointY);
      }
      context.strokeStyle = `rgba(96, 220, 239, ${0.22 * intensity})`;
      context.lineWidth = 0.55;
      context.stroke();

      const branch = points[Math.floor(points.length * 0.62)];
      const branchSide = strand.angleOffset < 0 ? -1 : 1;
      const branchEnd = {
        x: branch.x + -strand.directionY * branchSide * (4 + (strand.length % 8)),
        y: branch.y + strand.directionX * branchSide * (4 + (strand.length % 8)),
      };
      context.beginPath();
      context.moveTo(branch.x, branch.y);
      context.lineTo(branch.x + (branchEnd.x - branch.x) * 0.56 + 2, branch.y + (branchEnd.y - branch.y) * 0.38 - 2);
      context.lineTo(branchEnd.x, branchEnd.y);
      context.strokeStyle = `rgba(70, 224, 245, ${0.42 * intensity})`;
      context.lineWidth = 0.55;
      context.shadowColor = "rgba(35, 205, 238, 0.7)";
      context.shadowBlur = 4 * intensity;
      context.stroke();
      context.shadowBlur = 0;

      const root = points[0];
      context.beginPath();
      context.ellipse(root.x, root.y, 4.2 * intensity, 5.2 * intensity, 0, 0, Math.PI * 2);
      const rootGradient = context.createRadialGradient(root.x - 1, root.y - 2, 0, root.x, root.y, 8 * intensity);
      rootGradient.addColorStop(0, "rgba(110, 117, 119, 0.88)");
      rootGradient.addColorStop(0.35, "rgba(49, 54, 57, 0.98)");
      rootGradient.addColorStop(1, "rgba(13, 15, 17, 0.98)");
      context.fillStyle = rootGradient;
      context.fill();

      const tip = points[points.length - 1];
      const glint = 0.18 + (Math.sin(time * 0.004 + strand.angleOffset * 9) + 1) * 0.12;
      context.beginPath();
      context.arc(tip.x, tip.y, 1.25 * intensity, 0, Math.PI * 2);
      context.fillStyle = `rgba(79, 225, 248, ${glint * intensity})`;
      context.fill();
      context.beginPath();
      context.arc(tip.x, tip.y, Math.max(0.7, widths[widths.length - 1]) * intensity, 0, Math.PI * 2);
      context.fillStyle = "rgba(36, 40, 42, 0.96)";
      context.fill();
      context.globalAlpha = 1;
    }

    let frameDelta = 1 / 60;
    function render(time) {
      frameId = 0;
      const elapsed = previousTime ? Math.min((time - previousTime) / 1000, 0.034) : 1 / 60;
      frameDelta = Math.max(elapsed, 1 / 120);
      previousTime = time;
      energy += (energyTarget - energy) * Math.min(1, frameDelta * (energyTarget > energy ? 8 : 6.5));

      context.clearRect(0, 0, width, height);
      if (energy > 0.012) {
        const rect = button.getBoundingClientRect();
        strands.forEach((strand) => drawStrand(strand, time, energy * effectScale, rect));
      } else {
        energy = 0;
      }

      if (energy > 0 || energyTarget > 0) requestFrame();
      else {
        previousTime = 0;
        releaseCanvas();
      }
    }

    function handleTouch(event) {
      if (event.pointerType !== "touch" || motionPreference.matches) return;
      const point = getLocalPointer(event);
      initialize();
      pointer.x = point.x;
      pointer.y = point.y;
      resetStrands();
      energyTarget = 1;
      window.clearTimeout(pulseTimer);
      pulseTimer = window.setTimeout(() => {
        energyTarget = 0;
        requestFrame();
      }, 240);
      requestFrame();
    }

    function handleFocus() {
      if (motionPreference.matches) return;
      initialize();
      const rect = button.getBoundingClientRect();
      pointer.x = padding + rect.width / 2;
      pointer.y = padding + rect.height / 2;
      resetStrands();
      energyTarget = 0.55;
      requestFrame();
    }

    function handleBlur() {
      energyTarget = 0;
      button.style.setProperty("--magnetic-x", "0px");
      button.style.setProperty("--magnetic-y", "0px");
      requestFrame();
    }

    function handleMotionPreferenceChange() {
      if (motionPreference.matches) {
        energyTarget = 0;
        energy = 0;
        if (frameId) window.cancelAnimationFrame(frameId);
        frameId = 0;
        context.clearRect(0, 0, width, height);
        releaseCanvas();
        button.style.setProperty("--magnetic-x", "0px");
        button.style.setProperty("--magnetic-y", "0px");
      }
    }

    function handlePointerOut(event) {
      if (event.relatedTarget !== null) return;
      energyTarget = 0;
      pointer.clientX = null;
      pointer.clientY = null;
      button.style.setProperty("--magnetic-x", "0px");
      button.style.setProperty("--magnetic-y", "0px");
      requestFrame();
    }

    function handleScroll() {
      const rect = button.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        energyTarget = 0;
        button.style.setProperty("--magnetic-x", "0px");
        button.style.setProperty("--magnetic-y", "0px");
        requestFrame();
        return;
      }
      if (pointer.clientX !== null) {
        updatePointer({ pointerType: "mouse", clientX: pointer.clientX, clientY: pointer.clientY });
      }
    }

    resize();
    instances.push({ button, resize, updatePointer, handlePointerOut, handleScroll });
    button.addEventListener("pointerdown", handleTouch, { passive: true });
    button.addEventListener("focus", handleFocus);
    button.addEventListener("blur", handleBlur);
    motionPreference.addEventListener("change", handleMotionPreferenceChange);

    window.addEventListener("pagehide", () => {
      window.clearTimeout(pulseTimer);
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      button.removeEventListener("pointerdown", handleTouch);
      button.removeEventListener("focus", handleFocus);
      button.removeEventListener("blur", handleBlur);
      motionPreference.removeEventListener("change", handleMotionPreferenceChange);
      canvas.remove();
    }, { once: true });
  });

  function closestInstance(event) {
    let nearest = null;
    let nearestDistance = 76;
    instances.forEach((instance) => {
      const rect = instance.button.getBoundingClientRect();
      const x = Math.max(rect.left, Math.min(event.clientX, rect.right));
      const y = Math.max(rect.top, Math.min(event.clientY, rect.bottom));
      const distance = Math.hypot(event.clientX - x, event.clientY - y);
      if (distance < nearestDistance) {
        nearest = instance;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  function handleGlobalPointerMove(event) {
    if (event.pointerType === "touch" || motionPreference.matches) return;
    const next = closestInstance(event);
    if (activeInstance !== next) {
      activeInstance?.handlePointerOut({ relatedTarget: null });
      activeInstance = next;
    }
    activeInstance?.updatePointer(event);
  }

  function handleGlobalPointerOut(event) {
    if (event.relatedTarget !== null) return;
    activeInstance?.handlePointerOut(event);
    activeInstance = null;
  }

  function handleGlobalScroll() {
    activeInstance?.handleScroll();
  }

  function handleGlobalResize() {
    instances.forEach(instance => instance.resize());
  }

  window.addEventListener("resize", handleGlobalResize, { passive: true });
  window.addEventListener("pointermove", handleGlobalPointerMove, { passive: true });
  window.addEventListener("pointerout", handleGlobalPointerOut);
  window.addEventListener("scroll", handleGlobalScroll, { passive: true });
  window.addEventListener("pagehide", () => {
    window.removeEventListener("resize", handleGlobalResize);
    window.removeEventListener("pointermove", handleGlobalPointerMove);
    window.removeEventListener("pointerout", handleGlobalPointerOut);
    window.removeEventListener("scroll", handleGlobalScroll);
    activeInstance = null;
  }, { once: true });
})();
